import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import cortexLogo from "../assets/cortex-logo.png";
import cortexIcon from "../assets/cortex-favicon.png";
const COMPANIONS = [
    { id: "c1", top: "12%", left: "8%", size: "clamp(28px, 4vw, 52px)", delay: 0 },
    { id: "c2", top: "22%", right: "10%", size: "clamp(24px, 3.5vw, 44px)", delay: 0.4 },
    { id: "c3", bottom: "18%", left: "14%", size: "clamp(32px, 4.5vw, 56px)", delay: 0.8 },
    { id: "c4", bottom: "24%", right: "12%", size: "clamp(26px, 3vw, 40px)", delay: 1.2 },
    { id: "c5", top: "48%", left: "4%", size: "clamp(20px, 2.5vw, 36px)", delay: 0.6 },
];
export const LoginEpicScene = () => {
    const reduceMotion = useReducedMotion();
    const [coarsePointer, setCoarsePointer] = useState(false);
    useEffect(() => {
        setCoarsePointer(window.matchMedia("(pointer: coarse)").matches);
    }, []);
    const showHero = !coarsePointer;
    return (_jsxs(motion.div, { className: "login-epic-scene", "aria-hidden": true, initial: reduceMotion ? false : { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.8 }, children: [_jsxs("div", { className: "layer depth-0", "data-depth": "0", children: [_jsx(motion.div, { className: "login-epic-grid", animate: reduceMotion ? undefined : { opacity: [0.25, 0.45, 0.25] }, transition: { duration: 8, repeat: Infinity, ease: "easeInOut" } }), _jsx("div", { className: "login-epic-vignette" })] }), _jsxs("div", { className: "layer depth-1", "data-depth": "1", children: [_jsx(motion.div, { className: "login-epic-glow login-epic-glow--blue", animate: reduceMotion ? undefined : { scale: [1, 1.12, 1], opacity: [0.35, 0.55, 0.35] }, transition: { duration: 10, repeat: Infinity, ease: "easeInOut" } }), _jsx(motion.div, { className: "login-epic-glow login-epic-glow--teal", animate: reduceMotion ? undefined : { scale: [1.1, 1, 1.1], opacity: [0.2, 0.4, 0.2] }, transition: { duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1 } })] }), _jsx("div", { className: "layer depth-2", "data-depth": "2", children: showHero &&
                    COMPANIONS.map((c) => (_jsx(motion.img, { src: cortexIcon, alt: "", className: "login-epic-node", style: {
                            ...("top" in c ? { top: c.top } : {}),
                            ...("left" in c ? { left: c.left } : {}),
                            ...("right" in c ? { right: c.right } : {}),
                            ...("bottom" in c ? { bottom: c.bottom } : {}),
                            width: c.size,
                            height: c.size,
                        }, initial: reduceMotion ? false : { opacity: 0, scale: 0.6 }, animate: reduceMotion
                            ? { opacity: 0.5 }
                            : { opacity: [0.35, 0.7, 0.35], y: [0, -10, 0], scale: [1, 1.05, 1] }, transition: {
                            duration: 6 + c.delay,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: c.delay,
                        } }, c.id))) }), showHero && (_jsx("div", { className: "layer depth-3", "data-depth": "3", children: _jsx(motion.img, { src: cortexLogo, alt: "", className: "login-epic-hero", initial: reduceMotion ? false : { opacity: 0, y: -40, scale: 0.85 }, animate: reduceMotion
                        ? { opacity: 1 }
                        : { opacity: 1, y: [0, -14, 0], scale: [1, 1.02, 1] }, transition: {
                        opacity: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
                        y: { duration: 9, repeat: Infinity, ease: "easeInOut", delay: 0.3 },
                        scale: { duration: 9, repeat: Infinity, ease: "easeInOut", delay: 0.3 },
                    } }) })), _jsx(motion.div, { className: "layer depth-5 login-epic-particles", "data-depth": "5", initial: reduceMotion ? false : { opacity: 0 }, animate: { opacity: 1 }, transition: { delay: 0.5, duration: 1 }, children: Array.from({ length: reduceMotion ? 0 : 18 }).map((_, i) => (_jsx("span", { className: "login-epic-particle", style: {
                        left: `${8 + (i * 17) % 84}%`,
                        top: `${10 + (i * 23) % 80}%`,
                        animationDelay: `${i * 0.35}s`,
                    } }, i))) })] }));
};
