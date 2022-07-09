struct Uniforms {
  resolution : vec2<u32>,
  f_resolution : vec2<f32>,
};

fn calc_index(coord : vec2<u32>) -> u32 {
    return coord.x + coord.y * uniforms.resolution.x;
}

fn is_active(cell : Cell) -> bool {
    return cell.mode != 0;
}