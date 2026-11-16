// Sección del tablero de pista (x en metros desde el eje, h bajo la rasante), compartida por los circuitos generados.
//  · DECK_SOLID: casco macizo para planetas y lunas. Un hombro exterior de 3,6 m por fuera del muro, costado inclinado
//    que baja 7,2 m y quilla en V hasta 9,6 m: la pista se lee como una viga-cajón, no como una lámina.
//  · DECK_THIN: la losa fina original (1,7 m), para el cinturón de asteroides y los anillos, donde lo ligero tiene sentido.
// Cada punto va duplicado para que las aristas salgan vivas (el barrido comparte vértices por punto de perfil).
const crisp = (p) => p.flatMap((q) => [q, q]);
export const DECK_THIN = [[-16.8, 0], [16.8, 0], [17.3, -0.6], [15.2, -1.7], [-15.2, -1.7], [-17.3, -0.6]];
export const DECK_SOLID = crisp([[-16.8, 0], [16.8, 0], [21.0, -0.6], [21.0, -2.1], [19.3, -7.2], [11.5, -8.8], [0, -9.6], [-11.5, -8.8], [-19.3, -7.2], [-21.0, -2.1], [-21.0, -0.6]]);
