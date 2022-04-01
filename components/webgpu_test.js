import React from 'react'
import triangleVertWGSL from '../shaders/triangle.vert.wgsl';
import redFragWGSL from '../shaders/red.frag.wgsl';


export default class WebGPUTest extends React.Component{
  constructor(props) {
    super(props);

    this.canvas_ref = React.createRef();
  }

  render(){
    return <canvas ref={this.canvas_ref}></canvas>
  }

  componentDidMount(){
    this.load_web_gpu()
    .then(() => {
      const context = this.canvas_ref.current.getContext('webgpu');

      const devicePixelRatio = window.devicePixelRatio || 1;
      const presentationSize = [
        this.canvas_ref.current.clientWidth * devicePixelRatio,
        this.canvas_ref.current.clientHeight * devicePixelRatio,
      ];
      const presentationFormat = context.getPreferredFormat(this.adapter);

      context.configure({
        device: this.device,
        format: presentationFormat,
        size: presentationSize,
      });

      const pipeline = this.device.createRenderPipeline({
        vertex: {
          module: this.device.createShaderModule({
            code: triangleVertWGSL,
          }),
          entryPoint: 'main',
        },
        fragment: {
          module: this.device.createShaderModule({
            code: redFragWGSL,
          }),
          entryPoint: 'main',
          targets: [
            {
              format: presentationFormat,
            },
          ],
        },
        primitive: {
          topology: 'triangle-list',
        },
      });

      function frame() {
        // Sample is no longer the active page.
        if (!this.canvas_ref.current) return;

        const commandEncoder = this.device.createCommandEncoder();
        const textureView = context.getCurrentTexture().createView();

        const renderPassDescriptor = {
          colorAttachments: [
            {
              view: textureView,
              clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        };

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(pipeline);
        passEncoder.draw(3, 1, 0, 0);
        passEncoder.end();

        this.device.queue.submit([commandEncoder.finish()]);
        requestAnimationFrame(frame.bind(this));
      }

      requestAnimationFrame(frame.bind(this));
    });
  }

  load_web_gpu(){
    if (!navigator.gpu) throw Error("WebGPU not supported.");
  
    return navigator.gpu.requestAdapter()
    .then((adapter) => {
      if (!adapter) throw Error("Couldn’t request WebGPU adapter.");
      this.adapter = adapter
      return adapter
    })
    .then((adapter) => adapter.requestDevice())
    .then((device) => {
      if (!device) throw Error("Couldn’t request WebGPU logical device.");
      this.device = device
    });
  }
}