// @ts-nocheck -- preserved behavioral regression suite with intentionally minimal DOM doubles.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mountControls } from '../packages/runtime/controls.js';
import { Input } from '../packages/runtime/input.js';
class Element extends EventTarget {
  constructor(tag='div'){super();this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.style={setProperty(){}};this.classList={add(){},remove(){},toggle(){}};this.hidden=false;this.disabled=false;}
  append(...nodes){this.children.push(...nodes);}
  appendChild(node){this.children.push(node);}
  setAttribute(){} setPointerCapture(){} remove(){this.removed=true;}
  getBoundingClientRect(){return {left:0,top:0,width:100,height:100};}
  contains(e){return e===this||this.children.includes(e);}
}
function env(){globalThis.window=new EventTarget();globalThis.document=new EventTarget();document.body=new Element();document.activeElement=document.body;document.createElement=tag=>new Element(tag);return document.body;}
function event(target,name,data={}){const e=new Event(name,{cancelable:true});for(const [k,v] of Object.entries(data))Object.defineProperty(e,k,{value:v});target.dispatchEvent(e);return e;}
test('joystick and action button maintain separate simultaneous pointers',()=>{const parent=env(),moves=[];let downs=0,ups=0;const c=mountControls({target:parent,adapter:{onMove:v=>moves.push(v),onActionDown:()=>downs++,onActionUp:()=>ups++}});c.setContext({joystickVisible:true,actionVisible:true});const [stick,action]=parent.children[0].children;event(stick,'pointerdown',{pointerId:1,clientX:90,clientY:50});event(action,'pointerdown',{pointerId:2});assert.equal(downs,1);assert.ok(moves.at(-1).x>.8);event(window,'pointerup',{pointerId:2});assert.equal(ups,1);assert.ok(moves.at(-1).x>.8);event(window,'pointerup',{pointerId:1});assert.equal(moves.at(-1).x,0);c.destroy();});
test('pointer cancel, hiding, blur and destroy release held controls',()=>{const parent=env(),moves=[];let ups=0;const c=mountControls({target:parent,adapter:{onMove:v=>moves.push(v),onActionUp:()=>ups++}});c.setContext({joystickVisible:true,actionVisible:true});const [stick,action]=parent.children[0].children;event(stick,'pointerdown',{pointerId:1,clientX:90,clientY:50});event(window,'pointercancel',{pointerId:1});assert.equal(moves.at(-1).x,0);event(action,'pointerdown',{pointerId:2});event(window,'blur');assert.equal(ups,1);event(stick,'pointerdown',{pointerId:3,clientX:10,clientY:50});c.setContext({controlsVisible:false});assert.equal(moves.at(-1).x,0);const n=moves.length;c.destroy();event(window,'pointermove',{pointerId:3,clientX:90,clientY:50});assert.equal(moves.length,n);});
test('keyboard supports arrows and E, normalizes diagonal, resets on focus loss',()=>{const parent=env(),calls=[],input=new Input(parent,x=>calls.push(x));input.block(false);event(window,'keydown',{code:'ArrowRight'});event(window,'keydown',{code:'ArrowDown'});assert.ok(Math.abs(Math.hypot(input.vector().x,input.vector().y)-1)<.001);event(window,'keydown',{code:'KeyE'});assert.equal(calls.at(-1),'interact');assert.equal(input.held,true);event(window,'blur');assert.deepEqual(input.vector(),{x:0,y:0});assert.equal(input.held,false);input.destroy();});
test('modal input blocks movement and repeated keydown cannot skip dialogue',()=>{const parent=env(),calls=[],input=new Input(parent,x=>calls.push(x));input.block(true);event(window,'keydown',{code:'KeyW'});event(window,'keydown',{code:'Space',repeat:false});event(window,'keydown',{code:'Space',repeat:true});assert.deepEqual(input.vector(),{x:0,y:0});assert.deepEqual(calls,['interact']);input.block(false);assert.deepEqual(input.vector(),{x:0,y:0});input.destroy();});
