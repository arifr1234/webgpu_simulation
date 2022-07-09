import React from 'react'
import triangleVertWGSL from '../shaders/triangle.vert.wgsl';
import fragWGSL from '../shaders/frag_shader.frag.wgsl';
import updateComputeWGSL from '../shaders/update.compute.wgsl';
import commonWGSL from '../shaders/common.wgsl';
import * as type_utils from './utils/type_utils'

export default class WebGPUTest extends React.Component{
  constructor(props) {
    super(props);

    this.canvas_ref = React.createRef();
    this.width = props.width;
    this.height = props.height;
  }

  render(){
    return <canvas ref={this.canvas_ref} width={this.width} height={this.height}></canvas>
  }

  componentDidMount(){
    this.load_web_gpu()
    .then(() => {
      this.generate_code();

      this.context = this.canvas_ref.current.getContext('webgpu');
      this.presentationFormat = navigator.gpu.getPreferredCanvasFormat();

      this.canvas_ref.current.style = "image-rendering: pixelated;";

      this.context.configure({
        device: this.device,
        format: this.presentationFormat,
        alphaMode: "opaque",  // Note: No alpha
      });

      this.canvas_size = [
        this.canvas_ref.current.width,
        this.canvas_ref.current.height,
      ];

      this.pixel_num = this.canvas_size[0] * this.canvas_size[1];
      this.ping_pong_buffer_size = this.pixel_num * this.cell_byte_size;

      this.bind_group_layout = this.create_bind_group_layout();

      this.uniform_buffer = this.create_uniform_buffer();

      const initial = new DataView(new ArrayBuffer(this.ping_pong_buffer_size));

      const particles = [];

      for(var i=0; i < 10; i++){
        particles.push({
          pos: this.canvas_size.map(x => (1 - Math.random()) * x), 
          vel: [Math.random(), Math.random()].map(x => (2 * x - 1) / 10)
        });
      }
      
      particles.forEach((particle, i) => {
        const set_float32 = (offset, value) => {
          initial.setFloat32(i * this.cell_byte_size + offset * 4, value, true);
        };
        
        set_float32(0, particle.pos[0]);
        set_float32(1, particle.pos[1]);
        set_float32(2, particle.vel[0]);
        set_float32(3, particle.vel[1]);
        initial.setUint32(i * this.cell_byte_size + 4 * 4, 1, true);
      });
      

      this.ping_pong_buffers = this.create_ping_pong_buffers(initial.buffer);
      this.ping_pong_bind_groups = this.create_ping_pong_bind_groups(this.bind_group_layout);

      this.compute_pipeline = this.create_compute_pipeline(this.bind_group_layout);

      this.render_pipeline = this.create_render_pipeline(this.bind_group_layout);

      requestAnimationFrame(this.frame.bind(this));
    });
  }

  generate_code(){
    const structs = [
      type_utils.struct("Particle", [
        ["pos", type_utils.vec2(type_utils.F32)],
        ["vel", type_utils.vec2(type_utils.F32)],
      ]),
      type_utils.struct("BodyCell", [
        ["a", type_utils.U32],
        ["b", type_utils.U32],
        ["c", type_utils.U32],
      ]),
    ];
    const MODES = {"Particle": 1, "BodyCell": 2};

    const modes_wgsl = Object.entries(MODES).map(mode => `var<private> ${mode[0].toUpperCase()} : u32 = ${mode[1]};\n`).join("");
    console.log(modes_wgsl);

    const max_struct_size = Math.max(...structs.map(struct => struct.size));
    const ELEMENT_TYPE = type_utils.U32;
    const total_elements_num = Math.ceil(type_utils.round_up(Math.max(ELEMENT_TYPE.size, 4), max_struct_size) / ELEMENT_TYPE.size);
    const CELL_STRUCT_NAME = "Cell";

    var cell_struct_elements = [];

    cell_struct_elements = cell_struct_elements.concat(
      Array(Math.floor(total_elements_num / 4)).fill().map((x, i) => {
        return [`d_${i}`, type_utils.vec4(ELEMENT_TYPE)];
      })
    );

    if(total_elements_num % 4 != 0)
      cell_struct_elements = cell_struct_elements.concat([
        [`d_${Math.floor(total_elements_num / 4)}`, type_utils[`vec${total_elements_num % 4}`](ELEMENT_TYPE)],
      ]);

    cell_struct_elements = cell_struct_elements.concat([
      ["mode", type_utils.U32],
    ]);

    const cell_struct = type_utils.struct(CELL_STRUCT_NAME, cell_struct_elements, false, true);
    this.cell_byte_size = cell_struct.size;

    const structs_wgsl = structs.concat(cell_struct).map(struct => struct.definition).join("\n");

    console.log(structs_wgsl);

    var from_cell_bitcast_wgsl = structs.map(struct => {
      var index_offset = 0;
      var conversions = [];

      for (const [name, type] of struct.elements) {
        console.assert(type.size % ELEMENT_TYPE.size == 0, `Cant represent type "${type.str}" of size ${type.size}, with an array of "${ELEMENT_TYPE.str}" of size ${ELEMENT_TYPE.size}.`);

        const elements_num = Math.floor(type.size / ELEMENT_TYPE.size);  // floor is for casting only.
        
        console.assert(elements_num <= 4, `Types with size more then 4 times the size of "${ELEMENT_TYPE.str}" are not supported yet.`)  // TODO: implement both ways.
        var from = `cell.d_${Math.floor(index_offset / 4)}`;

        if(!(Math.floor(index_offset / 4) == Math.floor(total_elements_num / 4) && total_elements_num % 4 == 1))
          from = from + `.${type_utils.swizzle(index_offset % 4, index_offset % 4 + elements_num)}`;

        conversions.push(`bitcast<${type.str}>(${from})`);

        index_offset += elements_num;
      }

      var code = `${struct.str}(${conversions.join(", ")});`;
      return `fn get_as_${struct.str}(cell : ${CELL_STRUCT_NAME}) -> ${struct.str} {\n  return ${code}\n}\n`
    }).join("\n");

    console.log(from_cell_bitcast_wgsl);

    var to_cell_bitcast_wgsl = structs.map(struct => {
      var struct_element_index = 0;

      var conversions = [];

      const cell_struct_element_num = Math.ceil(total_elements_num / 4);

      for (let i = 0; i < cell_struct_element_num; i++) {
        var conversion = [];
        var inner_index = 0;

        var max_inner_index = 4;
        if(i == cell_struct_element_num - 1)
          max_inner_index = (total_elements_num + 3) % 4 + 1;

        while(inner_index < max_inner_index)
        {
          if(struct_element_index < struct.elements.length)
          {
            const [name, type] = struct.elements[struct_element_index];

            const elements_num = Math.floor(type.size / ELEMENT_TYPE.size);
            const cast_to = type_utils[`vec${elements_num}`](ELEMENT_TYPE);

            conversion.push(`bitcast<${cast_to.str}>(cell.${name})`);

            inner_index += elements_num;
            struct_element_index += 1;
          }
          else
          {
            const missing_elements = max_inner_index - inner_index;

            if (missing_elements == 1)
              conversion.push(`${ELEMENT_TYPE.str}()`);
            else
              conversion.push(`vec${missing_elements}<${ELEMENT_TYPE.str}>()`);
            
            inner_index += missing_elements;
          }
        }

        conversion = conversion.join(", ");
        if(max_inner_index != 1)
          conversion = `vec${max_inner_index}<${ELEMENT_TYPE.str}>(${conversion})`;

        conversions.push(conversion);
      }

      var code = `${CELL_STRUCT_NAME}(${conversions.join(", ")}, ${MODES[struct.str]});`;
      return `fn ${struct.str}_as_${CELL_STRUCT_NAME}(cell : ${struct.str}) -> ${CELL_STRUCT_NAME} {\n  return ${code}\n}\n`
    }).join("\n");

    console.log(to_cell_bitcast_wgsl);

    const common_wgsl = [modes_wgsl, structs_wgsl, from_cell_bitcast_wgsl, to_cell_bitcast_wgsl, commonWGSL].join("\n\n");
    updateComputeWGSL += common_wgsl;
    fragWGSL += common_wgsl;
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

  create_bind_group_layout() {
    return this.device.createBindGroupLayout({
      entries: [{
          binding: 0,
          visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" }
      }, 
      {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
          buffer: { type: "read-only-storage" }
      }, 
      {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
          buffer: { type: "storage" }
      }]
    });
  }

  create_compute_pipeline(bind_group_layout){
    return this.device.createComputePipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [bind_group_layout],
      }),
      compute: {
        module: this.device.createShaderModule({
          code: updateComputeWGSL,
        }),
        entryPoint: 'main',
      },
    });
  }

  create_ping_pong_buffers(initial) {
    return {
      in: this.create_ping_pong_buffer(initial),
      out: this.create_ping_pong_buffer(new ArrayBuffer(this.ping_pong_buffer_size))
    }
  }
  create_ping_pong_buffer(data) {
    return this.create_buffer(
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      data
    )
  }

  create_ping_pong_bind_groups(layout) {
    return {
      in: this.create_ping_pong_bind_group(this.ping_pong_buffers.in, this.ping_pong_buffers.out, layout),
      out: this.create_ping_pong_bind_group(this.ping_pong_buffers.out, this.ping_pong_buffers.in, layout)
    }
  }

  create_ping_pong_bind_group(in_buffer, out_buffer, layout) {
    return this.device.createBindGroup({
      layout: layout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.uniform_buffer,
            offset: 0,
            size: this.uniform_size,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: in_buffer,
            offset: 0,
            size: this.ping_pong_buffer_size,
          },
        },
        {
          binding: 2,
          resource: {
            buffer: out_buffer,
            offset: 0,
            size: this.ping_pong_buffer_size,
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
    new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(data));
    buffer.unmap();

    return buffer;
  }

  create_render_pipeline(bind_group_layout){
    return this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [bind_group_layout],
      }),
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
    this.uniform_size = (
      2 * 4 +  // resolution
      2 * 4    // f_resolution
    );
    return this.create_buffer(
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      new ArrayBuffer(this.uniform_size)
    )
  }

  frame() {
    var uniform_data = new DataView(new ArrayBuffer(this.uniform_size));

    uniform_data.setUint32 (0 * 4, this.canvas_size[0], true);
    uniform_data.setUint32 (1 * 4, this.canvas_size[1], true);
    uniform_data.setFloat32(2 * 4, this.canvas_size[0], true);
    uniform_data.setFloat32(3 * 4, this.canvas_size[1], true);
    
    this.device.queue.writeBuffer(
      this.uniform_buffer,
      0,
      uniform_data.buffer,
      uniform_data.byteOffset,
      uniform_data.byteLength
    );

    const out_initial_data = new Uint8Array(this.ping_pong_buffer_size);
    this.device.queue.writeBuffer(
      this.ping_pong_buffers.out,
      0,
      out_initial_data.buffer,
      out_initial_data.byteOffset,
      out_initial_data.byteLength
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

    const render_command_encoder = this.device.createCommandEncoder();

    const render_pass_encoder = render_command_encoder.beginRenderPass(renderPassDescriptor);
    render_pass_encoder.setPipeline(this.render_pipeline);
    render_pass_encoder.setBindGroup(0, this.ping_pong_bind_groups.in);
    render_pass_encoder.draw(4, 2, 0, 0);
    render_pass_encoder.end();

    this.device.queue.submit([render_command_encoder.finish()]);
    

    const compute_command_encoder = this.device.createCommandEncoder();

    const compute_pass_encoder = compute_command_encoder.beginComputePass();
    compute_pass_encoder.setPipeline(this.compute_pipeline);
    compute_pass_encoder.setBindGroup(0, this.ping_pong_bind_groups.in);
    compute_pass_encoder.dispatchWorkgroups(Math.ceil(this.pixel_num / 64));
    compute_pass_encoder.end();

    this.device.queue.submit([compute_command_encoder.finish()]);

    [this.ping_pong_bind_groups.in, this.ping_pong_bind_groups.out] = [this.ping_pong_bind_groups.out, this.ping_pong_bind_groups.in];
    [this.ping_pong_buffers.in, this.ping_pong_buffers.out] = [this.ping_pong_buffers.out, this.ping_pong_buffers.in];

    // setTimeout(this.frame.bind(this), 1000);
    requestAnimationFrame(this.frame.bind(this));
  }
}