@binding(0) @group(0) var<uniform> uniforms : Uniforms;
@binding(1) @group(0) var<storage, read> in_buffer : array<Cell>;
@binding(2) @group(0) var<storage, read_write> out_buffer : array<Cell>;

@stage(fragment)
fn main(@builtin(position) position : vec4<f32>) -> @location(0) vec4<f32> {
  var coord : vec2<u32> = vec2<u32>(position.xy);
  return vec4<f32>((in_buffer[coord.x + uniforms.resolution.x * coord.y]).color, 1.);
}