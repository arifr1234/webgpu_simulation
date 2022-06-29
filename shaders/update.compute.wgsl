@binding(0) @group(0) var<uniform> uniforms : Uniforms;
@binding(1) @group(0) var<storage, read> in_buffer : array<Cell>;
@binding(2) @group(0) var<storage, read_write> out_buffer : array<Cell>;

fn calc_index(coord : vec2<u32>) -> u32{
    return coord.x + coord.y * uniforms.resolution.x;
}

fn is_valid_coord(coord : vec2<u32>) -> bool {
    return coord.x < uniforms.resolution.x && coord.y < uniforms.resolution.y;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {
    var index : u32 = GlobalInvocationID.x;

    out_buffer[index] = in_buffer[index];

    var coord : vec2<u32> = vec2<u32>(index % uniforms.resolution.x, index / uniforms.resolution.x);

    if(in_buffer[index].color.x > 0.5)
    {
        var new_coord : vec2<u32> = coord + vec2<u32>(1, 0);
        if(is_valid_coord(new_coord))
        {
            out_buffer[calc_index(new_coord)].color.x = 1.;
        }

        out_buffer[index].color.x = 0.;
    }
}