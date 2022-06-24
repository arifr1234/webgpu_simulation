import WebGPUTest from "../components/webgpu_test"

export default function HomePage() {
  const css = `
  canvas {
    width:100%;
    height:100%;
  }
  `

  return (
    <div>
      <style>{css}</style>
      <h1>👷‍♂️</h1>
      <WebGPUTest width="5" height="5"></WebGPUTest>
    </div>
  )
}
