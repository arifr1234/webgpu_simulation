import { useState, useEffect } from 'react'

function Header({ title }) {
  return <h1>{title ? title : 'Default title'}</h1>
}

var adapter = null;
var device = null;

function load_web_gpu(){
  if (!navigator.gpu) throw Error("WebGPU not supported.");

  return navigator.gpu.requestAdapter()
  .then((_adapter) => {
    if (!_adapter) throw Error("Couldn’t request WebGPU adapter.");
    adapter = _adapter
    return _adapter
  })
  .then((adapter) => adapter.requestDevice())
  .then((_device) => {
    if (!_device) throw Error("Couldn’t request WebGPU logical device.");
    device = _device
  });
}

function main(){
  load_web_gpu()
  .then(() => {
    
  })
}

export default function HomePage() {
  useEffect(main);

  return (
    <div>
      <Header title="🚀" />
    </div>
  )
}
