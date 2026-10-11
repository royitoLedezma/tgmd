# TGMD-2 · App de evaluación motora

App web instalable (PWA) para grabar, puntuar y generar informes del TGMD-2.

- **App publicada:** https://royitoledezma.github.io/tgmd/
- **Datos:** Firebase Firestore (cada evaluador ve solo lo suyo). Sin Firebase configurado, funciona en modo local.
- **Videos:** se quedan solo en el celular.

## Etapas
- [x] Etapa 1 · Carpetas y niños, respaldo
- [x] Etapa 2 · Grabación
- [x] Etapa 3 · Puntuación con video
- [ ] Etapa 4 · Cálculos y tablas normativas
- [ ] Etapa 5 · Excel e informes
- [ ] Etapa 6 · Prueba real

## Para desarrolladores
```
npm install
npm run dev     # servidor local
npm run build   # versión para publicar (carpeta dist)
```
La publicación es automática: cada cambio en la rama `main` se publica en GitHub Pages.
Las tablas normativas del manual **no** van en este repositorio (tienen derechos de autor).
