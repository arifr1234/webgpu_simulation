@binding(0) @group(0) var<uniform> uniforms : Uniforms;
@binding(1) @group(0) var<storage, read> in_buffer : array<Cell>;
@binding(2) @group(0) var<storage, read_write> out_buffer : array<Cell>;

var<private> INACTIVE_CELL: Cell = Cell(vec2<f32>(-1., 0.), vec2<f32>(0., 0.));

fn is_valid_coord(coord : vec2<f32>) -> bool {
    return 0 <= coord.x && coord.x < uniforms.f_resolution.x && 0 <= coord.y && coord.y < uniforms.f_resolution.y;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {
    var index : u32 = GlobalInvocationID.x;

    var this : Cell = in_buffer[index];

    if(is_active(this))
    {
        var coord : vec2<u32> = vec2<u32>(index % uniforms.resolution.x, index / uniforms.resolution.x);

        var new_pos : vec2<f32> = this.pos + this.vel;

        out_buffer[index] = INACTIVE_CELL;
        if(is_valid_coord(new_pos))
        {
            out_buffer[calc_index(vec2<u32>(new_pos))] = Cell(new_pos, this.vel);
        }
    }
    else
    {
        out_buffer[index] = INACTIVE_CELL;
    }
}