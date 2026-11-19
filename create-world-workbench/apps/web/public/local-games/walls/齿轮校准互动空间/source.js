(function () {
"use strict";
let __bwmMountOptions = null;
const __bwmRuntime = window.BeyondWallsReactRuntime;
if (!__bwmRuntime) throw new Error("Load shared/react-runtime.js before 齿轮校准互动空间/source.js");
const _ = __bwmRuntime.React;
const v = __bwmRuntime.ReactDOM;
const w = __bwmRuntime.jsxRuntime;
var y = Object.freeze({
	INNER: "inner",
	OUTER: "outer"
});
function b(e) {
	let t = String(e), n = 2166136261;
	for (let e = 0; e < t.length; e += 1) n ^= t.charCodeAt(e), n = Math.imul(n, 16777619);
	return n >>> 0;
}
function x(e) {
	let t = b(e) || 2654435769;
	return () => {
		t += 1831565813;
		let e = t;
		return e = Math.imul(e ^ e >>> 15, e | 1), e ^= e + Math.imul(e ^ e >>> 7, e | 61), ((e ^ e >>> 14) >>> 0) / 4294967296;
	};
}
function ee(e) {
	let t = Math.PI * 2;
	return (e % t + t) % t;
}
function S(e, t) {
	let n = Math.abs(ee(e) - ee(t));
	return Math.min(n, Math.PI * 2 - n);
}
function C(e) {
	let t = x(e), n = [];
	for (let e of [y.OUTER, y.INNER]) {
		let r = t() * Math.PI * 2;
		for (let i = 0; i < 5; i += 1) {
			let a = i / 5 * Math.PI * 2, o = (t() - .5) * .36;
			n.push({
				id: `${e}-${i}`,
				track: e,
				angle: ee(r + a + o)
			});
		}
	}
	return n;
}
function te(e, t, n, r, i = .105) {
	return e.filter((e) => e.track === n && !t.has(e.id) && S(e.angle, r) <= i).map((e) => e.id);
}
var T = "1.0.0", re = 420, E = re / 2, ie = 104, ae = 154, oe = 1.3;
function se() {
	if (typeof window > "u") return {
		seed: Date.now(),
		embedded: !1,
		nextDestination: null,
		speed: oe
	};
	let e = new URLSearchParams(window.location.search), t = e.get("speed"), n = t === null ? NaN : Number(t), r = __bwmMountOptions || {};
	return {
		seed: r.seed || e.get("seed") || Date.now(),
		embedded: typeof r.embedded === "boolean" ? r.embedded : e.get("embed") === "1",
		nextDestination: r.nextDestination || e.get("next"),
		speed: Number.isFinite(n) ? Math.min(4, Math.max(.4, n)) : oe
	};
}
function D(e, t) {
	let n = {
		source: "gear-calibration",
		version: T,
		type: e,
		detail: t
	};
	if (__bwmMountOptions && typeof __bwmMountOptions.onEvent === "function") __bwmMountOptions.onEvent(n);
	window.dispatchEvent(new CustomEvent(e.toLowerCase(), { detail: t }));
}
function O({ name: e }) {
	return /* @__PURE__ */ (0, w.jsx)("svg", {
		viewBox: "0 0 24 24",
		"aria-hidden": "true",
		children: /* @__PURE__ */ (0, w.jsx)("path", { d: {
			undo: "M4 7h10a5 5 0 0 1 0 10h-2v-2h2a3 3 0 1 0 0-6H4l3 3-1.4 1.4L.2 8l5.4-5.4L7 4z",
			sound: "M3 9v6h4l5 4V5L7 9H3zm12.5 3a4 4 0 0 0-2-3.46v6.92A4 4 0 0 0 15.5 12zm0-7v2.06a6 6 0 0 1 0 9.88V19a8 8 0 0 0 0-14z",
			mute: "M3 9v6h4l5 4V5L7 9H3zm11.7.3-1.4 1.4 1.3 1.3-1.3 1.3 1.4 1.4 1.3-1.3 1.3 1.3 1.4-1.4-1.3-1.3 1.3-1.3-1.4-1.4-1.3 1.3z"
		}[e] })
	});
}
function le(e, t = oe) {
	return {
		seed: e,
		speed: t,
		angle: -Math.PI / 2,
		track: y.OUTER,
		radius: ae,
		targets: C(e),
		collectedIds: /* @__PURE__ */ new Set(),
		lastTime: null
	};
}
function k(e, t) {
	return {
		x: Math.round(E + Math.cos(e) * t),
		y: Math.round(E + Math.sin(e) * t)
	};
}
function ue(e, t) {
	e.save(), e.translate(E, E), e.rotate(t), e.beginPath();
	for (let t = 0; t < 24; t += 1) {
		let n = t / 24 * Math.PI * 2, r = Math.PI * 2 / 24, i = [
			[n, 177],
			[n + r * .17, 177],
			[n + r * .24, 193],
			[n + r * .76, 193],
			[n + r * .83, 177],
			[n + r, 177]
		];
		for (let [r, a] of i) {
			let i = Math.round(Math.cos(r) * a), o = Math.round(Math.sin(r) * a);
			t === 0 && r === n ? e.moveTo(i, o) : e.lineTo(i, o);
		}
	}
	e.closePath(), e.fillStyle = "#21150f", e.fill(), e.lineWidth = 5, e.strokeStyle = "#050404", e.stroke(), e.lineWidth = 2, e.strokeStyle = "#80502a", e.stroke(), e.beginPath(), e.arc(0, 0, 174, 0, Math.PI * 2), e.fillStyle = "#100c0b", e.fill(), e.lineWidth = 3, e.strokeStyle = "#a2662c", e.stroke(), e.restore();
}
function de(e, t, n) {
	e.beginPath(), e.arc(E, E, t, 0, Math.PI * 2), e.lineWidth = n ? 9 : 7, e.strokeStyle = n ? "#2d1b10" : "#170f0c", e.stroke(), e.setLineDash([2, 5]), e.lineDashOffset = +!!n, e.beginPath(), e.arc(E, E, t, 0, Math.PI * 2), e.lineWidth = n ? 3 : 2, e.strokeStyle = n ? "#d49136" : "#704524", e.stroke(), e.setLineDash([]);
	for (let n = 0; n < 32; n += 1) {
		let r = k(n / 32 * Math.PI * 2, t);
		e.fillStyle = n % 4 == 0 ? "#c17b2d" : "#52311d", e.fillRect(r.x - 1, r.y - 1, 3, 3);
	}
}
function A(e, t, n) {
	if (n) return;
	let r = t.track === y.OUTER ? ae : ie, i = k(t.angle, r);
	e.fillStyle = "rgba(220, 143, 43, 0.2)", e.fillRect(i.x - 8, i.y - 8, 16, 16), e.fillStyle = "#5f351a", e.fillRect(i.x - 5, i.y - 5, 10, 10), e.fillStyle = "#f1b94d", e.fillRect(i.x - 3, i.y - 3, 6, 6), e.fillStyle = "#fff0a4", e.fillRect(i.x - 1, i.y - 1, 2, 2);
}
function j(e, t, n) {
	let r = k(t, n);
	e.fillStyle = "rgba(238, 165, 50, 0.18)", e.fillRect(r.x - 13, r.y - 13, 26, 26), e.fillStyle = "#160d08", e.fillRect(r.x - 9, r.y - 9, 18, 18), e.fillStyle = "#d98528", e.fillRect(r.x - 7, r.y - 7, 14, 14), e.fillStyle = "#ffd56a", e.fillRect(r.x - 5, r.y - 5, 10, 10), e.fillStyle = "#fff4b8", e.fillRect(r.x - 3, r.y - 3, 4, 4);
}
function fe(e, t, n) {
	e.clearRect(0, 0, re, re), e.imageSmoothingEnabled = !1;
	for (let t = 0; t < 34; t += 1) {
		let n = t * 73 % re, r = t * 47 % re;
		e.fillStyle = t % 3 == 0 ? "#2b1b12" : "#15100d", e.fillRect(n, r, 2, 2);
	}
	ue(e, -t.angle * .025), e.beginPath(), e.arc(E, E, 78, 0, Math.PI * 2), e.fillStyle = "#090707", e.fill(), e.lineWidth = 5, e.strokeStyle = "#2e1c12", e.stroke(), e.lineWidth = 2, e.strokeStyle = "#8a5529", e.stroke(), de(e, ae, t.track === y.OUTER), de(e, ie, t.track === y.INNER), e.fillStyle = "#6f4525", e.fillRect(E - 3, E - 31, 6, 62), e.fillRect(E - 31, E - 3, 62, 6), e.fillStyle = "#b77731", e.fillRect(E - 9, E - 9, 18, 18), e.fillStyle = "#130d0a", e.fillRect(E - 4, E - 4, 8, 8);
	for (let n of t.targets) A(e, n, t.collectedIds.has(n.id));
	n !== "complete" && j(e, t.angle, t.radius);
}
function pe({ status: e, collectedCount: t }) {
	return e === "complete" ? /* @__PURE__ */ (0, w.jsx)("div", {
		className: "gear-result-shade",
		role: "status",
		"aria-live": "assertive",
		children: /* @__PURE__ */ (0, w.jsxs)("div", {
			className: "gear-result-card",
			children: [
				/* @__PURE__ */ (0, w.jsx)("span", {
					className: "gear-result-card__spark",
					children: "✦"
				}),
				/* @__PURE__ */ (0, w.jsx)("div", {
					className: "gear-result-card__rune",
					children: "⌾"
				}),
				/* @__PURE__ */ (0, w.jsx)("p", {
					className: "gear-result-card__eyebrow",
					children: "全部光点已收集"
				}),
				/* @__PURE__ */ (0, w.jsx)("h2", { children: "校准完成" }),
				/* @__PURE__ */ (0, w.jsx)("p", { children: `已完成 ${t} / 10 个校准点。` }),
				/* @__PURE__ */ (0, w.jsx)("p", {
					className: "gear-result-card__continuing",
					children: "正在进入下一部分…"
				})
			]
		})
	}) : null;
}
function me({ status: e, onStart: t }) {
	return e === "ready" ? /* @__PURE__ */ (0, w.jsx)("div", {
		className: "gear-intro",
		role: "button",
		tabIndex: 0,
		"aria-label": "点击开始齿轮校准",
		onPointerDown: (e) => {
			e.button !== void 0 && e.button !== 0 || (e.preventDefault(), t());
		},
		children: /* @__PURE__ */ (0, w.jsxs)("div", {
			className: "gear-intro__message",
			children: [/* @__PURE__ */ (0, w.jsx)("p", { children: "校准球会沿圆环自动移动，点击屏幕切换内外轨道，收集全部光点。" }), /* @__PURE__ */ (0, w.jsx)("span", { children: "点击空白处开始" })]
		})
	}) : null;
}
function he() {
	let e = (0, _.useMemo)(se, []), t = (0, _.useRef)(null), n = (0, _.useRef)(le(e.seed, e.speed)), r = (0, _.useRef)("ready"), i = (0, _.useRef)(!0), a = (0, _.useRef)(!1), o = (0, _.useRef)({}), s = (0, _.useRef)(() => {}), c = (0, _.useRef)(() => {}), l = (0, _.useRef)(() => {}), u = (0, _.useRef)(e.nextDestination), d = (0, _.useRef)(null), f = (0, _.useRef)(null), [p, m] = (0, _.useState)("ready"), [h, g] = (0, _.useState)(y.OUTER), [v, b] = (0, _.useState)(0), [x, S] = (0, _.useState)(!0), [C, ne] = (0, _.useState)(!1), [E, oe] = (0, _.useState)("请阅读玩法说明，点击空白处开始校准。"), k = (0, _.useCallback)(() => {
		let e = n.current;
		return {
			seed: e.seed,
			status: r.current,
			solved: r.current === "complete",
			enabled: i.current,
			muted: a.current,
			track: e.track,
			angle: ee(e.angle),
			speed: e.speed,
			collectedCount: e.collectedIds.size,
			totalTargets: 10,
			remainingCount: 10 - e.collectedIds.size,
			collectedIds: [...e.collectedIds],
			targets: e.targets.map((e) => ({ ...e }))
		};
	}, []);
	o.current = k();
	let ue = (0, _.useCallback)((e, t = .08) => {
		if (!(a.current || typeof window > "u")) try {
			let n = window.AudioContext || window.webkitAudioContext;
			if (!n) return;
			d.current || (d.current = new n());
			let r = d.current, i = r.createOscillator(), a = r.createGain();
			i.type = "square", i.frequency.setValueAtTime(e, r.currentTime), a.gain.setValueAtTime(.035, r.currentTime), a.gain.exponentialRampToValueAtTime(1e-4, r.currentTime + t), i.connect(a), a.connect(r.destination), i.start(), i.stop(r.currentTime + t);
		} catch {}
	}, []), de = (0, _.useCallback)((e) => {
		let t = !!e;
		i.current = t, S(t);
	}, []), A = (0, _.useCallback)((e) => {
		let t = !!e;
		a.current = t, ne(t);
	}, []), j = (0, _.useCallback)(() => {
		!i.current || r.current !== "ready" || (n.current.lastTime = null, r.current = "playing", m("playing"), oe("校准开始，点击齿轮区域切换内外轨道。"), ue(460, .1), D("GEAR_CALIBRATION_START", k()));
	}, [k, ue]);
	c.current = j;
	let he = (0, _.useCallback)((e = {}) => {
		f.current && (window.clearTimeout(f.current), f.current = null);
		let t = n.current;
		n.current = le(e.seed ?? Date.now(), Number.isFinite(Number(e.speed)) ? Math.min(4, Math.max(.4, Number(e.speed))) : t.speed);
		let i = e.start === !0 ? "playing" : "ready";
		r.current = i, m(i), g(y.OUTER), b(0), oe(i === "playing" ? "校准已重新开始，点击齿轮区域切换内外轨道。" : "请阅读玩法说明，点击空白处开始校准。"), queueMicrotask(() => D("GEAR_CALIBRATION_RESET", k()));
	}, [k]);
	s.current = he;
	let ge = (0, _.useCallback)(() => {
		if (!i.current || r.current !== "playing") return;
		let e = n.current;
		e.track = e.track === y.OUTER ? y.INNER : y.OUTER, g(e.track), oe(e.track === y.OUTER ? "已切换到外圈轨道。" : "已切换到内圈轨道。"), ue(e.track === y.OUTER ? 420 : 320), D("GEAR_CALIBRATION_TOGGLE", k());
	}, [k, ue]);
	return l.current = ge, (0, _.useEffect)(() => {
		let e = t.current.getContext("2d"), a = 0;
		function s(t) {
			let c = n.current;
			c.lastTime === null && (c.lastTime = t);
			let l = Math.min((t - c.lastTime) / 1e3, .05);
			if (c.lastTime = t, i.current && r.current === "playing") {
				c.angle = ee(c.angle + c.speed * l);
				let e = c.track === y.OUTER ? ae : ie;
				c.radius += (e - c.radius) * Math.min(1, l * 11);
				let t = te(c.targets, c.collectedIds, c.track, c.angle);
				if (t.length > 0) {
					for (let e of t) c.collectedIds.add(e);
					let e = c.collectedIds.size;
					if (b(e), oe(`已收集 ${e} / 10 个校准光点。`), ue(560 + e * 24, .1), D("GEAR_CALIBRATION_COLLECT", {
						targetIds: t,
						state: k()
					}), e === 10) {
						r.current = "complete", m("complete"), oe("全部光点已经收集，齿轮校准完成。"), ue(780, .18), D("GEAR_CALIBRATION_COMPLETE", k());
					}
				}
			}
			fe(e, c, r.current), o.current = k(), a = window.requestAnimationFrame(s);
		}
		return a = window.requestAnimationFrame(s), () => window.cancelAnimationFrame(a);
	}, [k, ue]), (0, _.useEffect)(() => {
		let e = {
			version: T,
			reset: (e) => s.current(e),
			start: () => c.current(),
			getState: () => k(),
			toggleTrack: () => l.current(),
			setEnabled: de,
			setMuted: A,
			setSpeed: (e) => {
				let t = Number(e);
				Number.isFinite(t) && (n.current.speed = Math.min(4, Math.max(.4, t)));
			},
			setNextDestination: (e) => {
				u.current = e || null;
			}
		};
		window.GearCalibrationGame = e;
		D("GEAR_CALIBRATION_READY", e.getState());
		return () => {
			delete window.GearCalibrationGame;
		};
	}, [
		k,
		de,
		A
	]), (0, _.useEffect)(() => {
		function e(e) {
			(e.key === " " || e.key === "Enter") && (e.preventDefault(), r.current === "ready" ? j() : ge()), e.key.toLowerCase() === "r" && he(), e.key.toLowerCase() === "m" && A(!a.current);
		}
		return window.addEventListener("keydown", e), () => window.removeEventListener("keydown", e);
	}, [
		he,
		A,
		j,
		ge
	]), /* @__PURE__ */ (0, w.jsxs)("main", {
		className: `gear-game-shell ${e.embedded ? "is-embedded" : ""}`,
		children: [
			/* @__PURE__ */ (0, w.jsx)("div", { className: "gear-ambient gear-ambient--left" }),
			/* @__PURE__ */ (0, w.jsx)("div", { className: "gear-ambient gear-ambient--right" }),
			/* @__PURE__ */ (0, w.jsxs)("header", {
				className: "gear-game-header",
				children: [
					/* @__PURE__ */ (0, w.jsx)("button", {
						type: "button",
						className: "gear-icon-button",
						onClick: (e) => {
							e.stopPropagation(), he();
						},
						"aria-label": "重新开始，快捷键 R",
						title: "重新开始（R）",
						children: /* @__PURE__ */ (0, w.jsx)(O, { name: "undo" })
					}),
					/* @__PURE__ */ (0, w.jsxs)("div", {
						className: "gear-play-rule",
						children: [/* @__PURE__ */ (0, w.jsx)("h1", { children: "点击屏幕切换轨道" }), /* @__PURE__ */ (0, w.jsx)("p", { children: "让校准球沿齿轮圆环移动 · 收集内外圈的全部光点" })]
					}),
					/* @__PURE__ */ (0, w.jsx)("button", {
						type: "button",
						className: "gear-icon-button",
						onClick: (e) => {
							e.stopPropagation(), A(!C);
						},
						"aria-label": C ? "开启音效，快捷键 M" : "关闭音效，快捷键 M",
						"aria-pressed": C,
						title: "切换音效（M）",
						children: /* @__PURE__ */ (0, w.jsx)(O, { name: C ? "mute" : "sound" })
					})
				]
			}),
			/* @__PURE__ */ (0, w.jsxs)("div", {
				className: "gear-progress",
				"aria-label": `校准进度 ${v} / 10`,
				children: [
					/* @__PURE__ */ (0, w.jsx)("span", { children: "校准进度" }),
					/* @__PURE__ */ (0, w.jsx)("strong", { children: v }),
					/* @__PURE__ */ (0, w.jsx)("i", { children: "/" }),
					/* @__PURE__ */ (0, w.jsx)("b", { children: 10 }),
					/* @__PURE__ */ (0, w.jsx)("div", {
						className: "gear-progress__pixels",
						"aria-hidden": "true",
						children: Array.from({ length: 10 }, (e, t) => /* @__PURE__ */ (0, w.jsx)("em", { className: t < v ? "is-lit" : "" }, t))
					})
				]
			}),
			/* @__PURE__ */ (0, w.jsx)("section", {
				className: `gear-stage ${x && p === "playing" ? "is-active" : ""}`,
				"data-testid": "gear-stage",
				onPointerDown: (e) => {
					e.button !== void 0 && e.button !== 0 || (e.preventDefault(), ge());
				},
				"aria-label": "齿轮校准区域，点击切换轨道",
				children: /* @__PURE__ */ (0, w.jsxs)("div", {
					className: "gear-stage__frame",
					children: [
						/* @__PURE__ */ (0, w.jsx)("span", { className: "gear-corner gear-corner--one" }),
						/* @__PURE__ */ (0, w.jsx)("span", { className: "gear-corner gear-corner--two" }),
						/* @__PURE__ */ (0, w.jsx)("span", { className: "gear-corner gear-corner--three" }),
						/* @__PURE__ */ (0, w.jsx)("span", { className: "gear-corner gear-corner--four" }),
						/* @__PURE__ */ (0, w.jsx)("canvas", {
							ref: t,
							className: "gear-canvas",
							width: re,
							height: re,
							role: "img",
							"aria-label": `校准球当前位于${h === y.OUTER ? "外圈" : "内圈"}，已收集 ${v} 个光点`
						}),
						/* @__PURE__ */ (0, w.jsxs)("div", {
							className: "gear-track-label",
							"aria-hidden": "true",
							children: [
								/* @__PURE__ */ (0, w.jsx)("span", {
									className: h === y.INNER ? "is-active" : "",
									children: "内圈"
								}),
								/* @__PURE__ */ (0, w.jsx)("i", {}),
								/* @__PURE__ */ (0, w.jsx)("span", {
									className: h === y.OUTER ? "is-active" : "",
									children: "外圈"
								})
							]
						})
					]
				})
			}),
			/* @__PURE__ */ (0, w.jsxs)("footer", {
				className: "gear-game-footer",
				children: [
					/* @__PURE__ */ (0, w.jsx)("span", {}),
					/* @__PURE__ */ (0, w.jsx)("p", { children: "点击齿轮区域或按空格键 · 在内外轨道间切换" }),
					/* @__PURE__ */ (0, w.jsx)("span", {})
				]
			}),
			/* @__PURE__ */ (0, w.jsx)("div", {
				className: "gear-sr-only",
				"aria-live": "polite",
				children: E
			}),
			/* @__PURE__ */ (0, w.jsx)(me, {
				status: p,
				onStart: j
			}),
			/* @__PURE__ */ (0, w.jsx)(pe, {
				status: p,
				collectedCount: v
			})
		]
	});
}

window.BeyondWallsMiniGameSources = window.BeyondWallsMiniGameSources || {};
window.BeyondWallsMiniGameSources.gear = {
  Component: he,
  setMountOptions(options) {
    __bwmMountOptions = Object.assign({ embedded: true }, options || {});
  },
  clearMountOptions() {
    __bwmMountOptions = null;
  },
  getApi() {
    return window.GearCalibrationGame || null;
  }
};
})();
