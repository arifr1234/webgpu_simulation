@binding(0) @group(0) var<uniform> uniforms : Uniforms;
@binding(1) @group(0) var<storage, read> in_buffer : array<Cell>;
@binding(2) @group(0) var<storage, read_write> out_buffer : array<Cell>;

@stage(compute) @workgroup_size(64)
fn main(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {
    var index : u32 = GlobalInvocationID.x;

    var x : u32 = index % uniforms.resolution.x;
    var y : u32 = index / uniforms.resolution.x;

    out_buffer[index] = Cell(vec3<f32>(f32(x) / f32(uniforms.resolution.x), 1. - f32(y) / f32(uniforms.resolution.y), 1.));
}