@binding(0) @group(0) var<uniform> uniforms : Uniforms;
@binding(1) @group(0) var<storage, read> in_buffer : array<Cell>;
@binding(2) @group(0) var<storage, read_write> out_buffer : array<Cell>;

var<private> INACTIVE_CELL: Cell = Cell(vec2<f32>(0., 0.), vec2<f32>(0., 0.), 0);

fn is_valid_coord(coord : vec2<f32>) -> bool {
    return 0 <= coord.x && coord.x < uniforms.f_resolution.x && 0 <= coord.y && coord.y < uniforms.f_resolution.y;
}

fn calc_region(pos : vec2<f32>) -> vec2<i32> {
    return vec2<i32>(floor(pos / uniforms.f_resolution));
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {
    var index : u32 = GlobalInvocationID.x;

    var this : Cell = in_buffer[index];

    if is_active(this)
    {
        var coord : vec2<u32> = vec2<u32>(index % uniforms.resolution.x, index / uniforms.resolution.x);

        var new_cell : Cell = Cell(this.pos + this.vel, this.vel, 1);
        var new_coord : vec2<u32> = vec2<u32>(new_cell.pos);

        var region : vec2<i32> = calc_region(new_cell.pos);

        if region.x != 0{
            new_cell.vel.x *= -1.;
            new_coord = coord;
        }

        if region.y != 0 {
            new_cell.vel.y *= -1.;
            new_coord = coord;
        }

        var new_index : u32 = calc_index(new_coord);

        if is_active(in_buffer[new_index]) {
            new_index = index;
        }

        out_buffer[new_index] = new_cell;
    }
}