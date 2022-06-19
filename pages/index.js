import WebGPUTest from "../components/webgpu_test"

export default function HomePage() {
  return (
    <div>
      <h1>👷‍♂️</h1>
      <WebGPUTest width="200" height="200"></WebGPUTest>
      <WebGPUTest width="200" height="100"></WebGPUTest>
      <WebGPUTest width="200" height="50"></WebGPUTest>
      <WebGPUTest width="200" height="25"></WebGPUTest>
      <WebGPUTest width="100" height="200"></WebGPUTest>
    </div>
  )
}
