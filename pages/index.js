import WebGPUTest from "../components/webgpu_test"

export default function HomePage() {
  const css = `
  canvas {
    width:100%;
    height:100%;
    image-rendering: pixelated;
  }
  `

  return (
    <div>
      <style>{css}</style>
      <h1>👷‍♂️</h1>
      <WebGPUTest width="50" height="5"></WebGPUTest>
    </div>
  )
}
