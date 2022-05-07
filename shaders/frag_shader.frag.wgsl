struct Uniforms {
  resolution : vec2<f32>;
};

@binding(0) @group(0) var<storage, read> in_buffer : array<f32>;
@binding(0) @group(1) var<storage, read> uniforms : Uniforms;

@stage(fragment)
fn main(@builtin(position) position : vec4<f32>) -> @location(0) vec4<f32> {
  return vec4<f32>(position.xy, 0.0, 1.0);
}