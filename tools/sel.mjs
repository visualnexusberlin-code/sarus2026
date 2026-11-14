// Selección de triángulos de la nave (espacio original del modelo: morro −X, arriba +Y)
// devuelve una función (centroide c, normal n, luminancia lum del color base) → bool
export const lumAt = (img, u, v) => { const x = Math.min(img.w - 1, Math.max(0, Math.floor((u - Math.floor(u)) * img.w))), y = Math.min(img.h - 1, Math.max(0, Math.floor((v - Math.floor(v)) * img.h))); return img.d[y * img.w + x] / 255; };
export const SEL = {
  // ventanas: recortes oscuros en lo alto del cuerpo central (parabrisas delantero y ventana trasera de la caja)
  // ventana trasera de la segunda cabina (la caja de popa): cara oscura que mira atrás y arriba
  rear: (c, n, lum) => c[0] > 0.6 && c[1] > 0.12 && Math.abs(c[2]) < 0.09 && n[0] > 0.55 && lum < 0.22,
  // cabina alargada: paneles del canal central, entre los raíles laterales, del morro a la caja trasera
  channel: (c, n, lum) => Math.abs(c[2]) < +(process.env.CZ || 0.125) && c[0] > +(process.env.X0 || -0.66) && c[0] < +(process.env.X1 || 0.36) && c[1] > +(process.env.Y0 || 0.1) && n[1] > 0.25,
};
