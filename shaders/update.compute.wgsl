@binding(0) @group(0) var<uniform> uniforms : Uniforms;
@binding(1) @group(0) var<storage, read> in_buffer : array<f32>;
@binding(2) @group(0) var<storage, read_write> out_buffer : array<f32>;

@stage(compute) @workgroup_size(64)
fn main(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {
    var index : u32 = GlobalInvocationID.x;

    var x : u32 = index % uniforms.resolution.x;
    var y : u32 = index / uniforms.resolution.x;

    out_buffer[index] = f32(x) / f32(uniforms.resolution.x);
}