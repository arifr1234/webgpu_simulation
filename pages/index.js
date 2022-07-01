import WebGPUTest from "../components/webgpu_test"

export default function HomePage() {
  const css = `
  canvas {
    width:100%;
  }
  `

  return (
    <div>
      <style>{css}</style>
      <h1>👷‍♂️</h1>
      <WebGPUTest width="100" height="40"></WebGPUTest>
    </div>
  )
}
