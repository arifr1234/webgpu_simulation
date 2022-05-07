import React from 'react'
import triangleVertWGSL from '../shaders/triangle.vert.wgsl';
import fragWGSL from '../shaders/frag_shader.frag.wgsl';
import updateComputeWGSL from '../shaders/update.compute.wgsl';

export default class WebGPUTest extends React.Component{
  constructor(props) {
    super(props);

    this.canvas_ref = React.createRef();
  }

  render(){
    return <canvas ref={this.canvas_ref} style={{width: "100%", height: "100%"}}></canvas>
  }

  componentDidMount(){
    this.load_web_gpu()
    .then(() => {
      this.context = this.canvas_ref.current.getContext('webgpu');
      this.presentationFormat = this.context.getPreferredFormat(this.adapter);

      this.configure_context();

      this.pixel_num = this.presentationSize[0] * this.presentationSize[1];

      this.ping_pong_buffers = this.create_ping_pong_buffers();

      this.compute_pipeline = this.create_compute_pipeline();
      this.compute_ping_pong_bind_groups = this.create_compute_ping_pong_bind_groups();

      this.render_pipeline = this.create_render_pipeline();
      this.render_ping_pong_bind_groups = this.create_render_ping_pong_bind_groups();
      this.uniform_buffer = this.create_uniform_buffer();
      this.uniform_bind_group = this.create_uniform_bind_group();

      requestAnimationFrame(this.frame.bind(this));
    });
  }

  load_web_gpu(){
    if (!navigator.gpu) throw Error("WebGPU not supported.");
  
    return navigator.gpu.requestAdapter()
    .then((adapter) => {
      if (!adapter) throw Error("Couldn't request WebGPU adapter.");
      this.adapter = adapter
      return adapter
    })
    .then((adapter) => adapter.requestDevice())
    .then((device) => {
      if (!device) throw Error("Couldn't request WebGPU logical device.");
      this.device = device
    });
  }

  configure_context(){
    const devicePixelRatio = window.devicePixelRatio || 1;
    this.presentationSize = [
      this.canvas_ref.current.clientWidth * devicePixelRatio,
      this.canvas_ref.current.clientHeight * devicePixelRatio,
    ];

    this.context.configure({
      device: this.device,
      format: this.presentationFormat,
      size: this.presentationSize,
    });
  }

  create_compute_pipeline(){
    return this.device.createComputePipeline({
      compute: {
        module: this.device.createShaderModule({
          code: updateComputeWGSL,
        }),
        entryPoint: 'main',
      },
    });
  }

  create_ping_pong_buffers() {
    return {
      in: this.create_ping_pong_buffer(),
      out: this.create_ping_pong_buffer()
    }
  }
  create_ping_pong_buffer() {
    return this.create_buffer(
      GPUBufferUsage.STORAGE,
      new Float32Array(this.buffer_size)
    )
  }

  create_compute_ping_pong_bind_groups() {
    return {
      in: this.create_ping_pong_bind_group(this.ping_pong_buffers.in, this.ping_pong_buffers.out, this.compute_pipeline.getBindGroupLayout(0)),
      out: this.create_ping_pong_bind_group(this.ping_pong_buffers.out, this.ping_pong_buffers.in, this.compute_pipeline.getBindGroupLayout(0))
    }
  }

  create_render_ping_pong_bind_groups() {
    return {
      in: this.create_ping_pong_bind_group(this.ping_pong_buffers.in, this.ping_pong_buffers.out, this.render_pipeline.getBindGroupLayout(0)),
      out: this.create_ping_pong_bind_group(this.ping_pong_buffers.out, this.ping_pong_buffers.in, this.render_pipeline.getBindGroupLayout(0))
    }
  }

  create_ping_pong_bind_group(in_buffer, out_buffer, layout) {
    return this.device.createBindGroup({
      layout: layout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: in_buffer,
            offset: 0,
            size: this.buffer_size,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: out_buffer,
            offset: 0,
            size: this.buffer_size,
          },
        },
      ],
    });
  }

  create_buffer(usage, data) {
    const buffer = this.device.createBuffer({
      size: data.byteLength,
      usage: usage,
      mappedAtCreation: true,
    });
    new Float32Array(buffer.getMappedRange()).set(data);
    buffer.unmap();

    return buffer;
  }

  create_render_pipeline(){
    return this.device.createRenderPipeline({
      vertex: {
        module: this.device.createShaderModule({
          code: triangleVertWGSL,
        }),
        entryPoint: 'main',
      },
      fragment: {
        module: this.device.createShaderModule({
          code: fragWGSL,
        }),
        entryPoint: 'main',
        targets: [
          {
            format: this.presentationFormat,
          },
        ],
      },
      primitive: {
        topology: 'triangle-strip',
      },
    });
  }

  create_uniform_buffer() {
    return this.create_buffer(
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      new Float32Array(2)
    )
  }

  create_uniform_bind_group() {
    return this.device.createBindGroup({
      layout: this.render_pipeline.getBindGroupLayout(1),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.uniform_buffer,
          },
        }
      ]
    }); 
  }

  frame() {
    const commandEncoder = this.device.createCommandEncoder();

    const uniform_data = new Float32Array(this.presentationSize);
    this.device.queue.writeBuffer(
      this.uniform_buffer,
      0,
      uniform_data.buffer,
      uniform_data.byteOffset,
      uniform_data.byteLength
    );

    const textureView = this.context.getCurrentTexture().createView();
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

    const compute_pass_encoder = commandEncoder.beginComputePass();
    compute_pass_encoder.setPipeline(this.compute_pipeline);
    compute_pass_encoder.setBindGroup(0, this.compute_ping_pong_bind_groups.in);
    compute_pass_encoder.dispatch(Math.ceil(this.pixel_num / 64));
    compute_pass_encoder.end();

    const render_pass_encoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    render_pass_encoder.setPipeline(this.render_pipeline);
    render_pass_encoder.setBindGroup(0, this.render_ping_pong_bind_groups.in);
    render_pass_encoder.setBindGroup(1, this.uniform_bind_group);
    render_pass_encoder.draw(4, 2, 0, 0);
    render_pass_encoder.end();

    this.device.queue.submit([commandEncoder.finish()]);
    requestAnimationFrame(this.frame.bind(this));

    [this.compute_ping_pong_bind_groups.in, this.compute_ping_pong_bind_groups.out] = [this.compute_ping_pong_bind_groups.out, this.compute_ping_pong_bind_groups.in];
    [this.render_ping_pong_bind_groups.in, this.render_ping_pong_bind_groups.out] = [this.render_ping_pong_bind_groups.out, this.render_ping_pong_bind_groups.in];
    [this.ping_pong_buffers.in, this.ping_pong_buffers.out] = [this.ping_pong_buffers.out, this.ping_pong_buffers.in];
  }
}