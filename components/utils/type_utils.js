export const F32 = {size: 4, alignment: 4, str: "f32"}
export const I32 = {size: 4, alignment: 4, str: "i32"}
export const U32 = {size: 4, alignment: 4, str: "u32"}
export const F16 = {size: 2, alignment: 2, str: "f16"}

export function vec1(type){
    return type;
}

export function vec2(type){
    type = type.str;
    console.assert(["f32", "u32", "i32", "f16"].includes(type), `Invalid type: ${type}.`)

    if(type == "f16") return {size: 4, alignment: 4, str: `vec2<${type}>`}
    else return {size: 8, alignment: 8, str: `vec2<${type}>`};
}

export function vec3(type){
    type = type.str;
    console.assert(["f32", "u32", "i32", "f16"].includes(type), `Invalid type: ${type}.`)

    if(type == "f16") return {size: 6, alignment: 8, str: `vec3<${type}>`}
    else return {size: 12, alignment: 16, str: `vec3<${type}>`};
}

export function vec4(type){
    type = type.str;
    console.assert(["f32", "u32", "i32", "f16"].includes(type), `Invalid type: ${type}.`)

    if(type == "f16") return {size: 8, alignment: 8, str: `vec4<${type}>`}
    else return {size: 16, alignment: 16, str: `vec4<${type}>`};
}

export function round_up(by, num){
    return Math.ceil(num / by) * by;
}

export function array(type, size){
    return {size: size * round_up(type.alignment, type.size), alignment: type.alignment, str: `array<${type.str},${size}>`};
}

export function struct(name, elements, add_final_placeholder=false, ignore_final_alignment=false){
    var definition = "";
    var size = 0;
    var alignment = 0;

    for (const [name, type] of elements) {
        console.assert(size % type.alignment == 0, `Alignment doesn't match: element name: "${name}", alignment: ${type.alignment}, offset: ${size}.`);

        alignment = Math.max(alignment, type.alignment);

        definition += `    ${name} : ${type.str}, \n`;
        size += type.size;
    }

    if(add_final_placeholder) {
        const name = "final_placeholder";
        const PLACEHOLDER_TYPE = U32
        const type = array(PLACEHOLDER_TYPE, Math.floor((alignment - (size % alignment)) / PLACEHOLDER_TYPE.size));

        alignment = Math.max(alignment, type.alignment);

        definition += `    ${name} : ${type.str}, \n`;
        size += type.size;
    }

    if(ignore_final_alignment)
        size = round_up(alignment, size);
    else
        console.assert(size % alignment == 0, `Alignment doesn't match for the whole struct "${name}": struct alignment: ${alignment}, struct size: ${size}.`);

    definition = `struct ${name} {\n${definition}}\n`;

    return {size: size, alignment: alignment, str: name, definition: definition, elements: elements}
}

export function swizzle(start, end) {
    const letters = ["x", "y", "z", "w"];
    return letters.slice(start, end).join("");
}