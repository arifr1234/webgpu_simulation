struct Uniforms {
  resolution : vec2<f32>,
};

@binding(0) @group(0) var<uniform> uniforms : Uniforms;
@binding(1) @group(0) var<storage, read> in_buffer : array<f32>;

@stage(fragment)
fn main(@builtin(position) position : vec4<f32>) -> @location(0) vec4<f32> {
  return vec4<f32>(in_buffer[bitcast<i32>(position.x)], 1., 1., 1.0);
}