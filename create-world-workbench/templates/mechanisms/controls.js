/** Copy into project extensions. UI primitives only; each story owns its actual rules. */
export function controls(container,{signal}){
 const children=[];const text=(tag,value)=>{const el=document.createElement(tag);el.textContent=value;container.append(el);children.push(el);return el;};
 return{heading:value=>text('h3',value),message:value=>text('p',value),button(label,handler){const b=text('button',label);b.type='button';b.addEventListener('click',handler,{signal});return b;},destroy(){for(const el of children)el.remove();}};
}
