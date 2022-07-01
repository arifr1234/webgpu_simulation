@binding(0) @group(0) var<uniform> uniforms : Uniforms;
@binding(1) @group(0) var<storage, read> in_buffer : array<Cell>;
@binding(2) @group(0) var<storage, read_write> out_buffer : array<Cell>;

var<private> INACTIVE_CELL: Cell = Cell(vec2<f32>(-1., 0.), vec2<f32>(0., 0.));

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {
    var index : u32 = GlobalInvocationID.x;

    var this : Cell = in_buffer[index];

    if(is_active(this))
    {
        var coord : vec2<u32> = vec2<u32>(index % uniforms.resolution.x, index / uniforms.resolution.x);

        var new_pos : vec2<f32> = this.pos + this.vel;
        var new_coord : vec2<u32> = vec2<u32>(new_pos);

        if(is_valid_coord(new_coord))
        {
            out_buffer[index] = INACTIVE_CELL;
            out_buffer[calc_index(new_coord)] = Cell(new_pos, this.vel);
        }
    }
    else
    {
        out_buffer[index] = INACTIVE_CELL;
    }
}