# Curso de Discipulado: cómo ponerlo en la nube

Se usa lo mismo que para la app de Alabanzas: tu proyecto de Firebase **ANTIOQUIA** y GitHub Pages.

## 1. Datos de Firebase
1. Entra a console.firebase.google.com y abre **ANTIOQUIA**.
2. Ve al engranaje ⚙ › Configuración del proyecto › Tus apps.
3. Puedes usar la misma app web de Alabanzas (o crear otra con el icono `</>`).
4. Copia los valores de `firebaseConfig`.
5. Abre `index.html`, busca `CONFIGURACIÓN DE FIREBASE` y pega los valores entre las comillas.

## 2. Reglas de Firestore
En Firestore Database › Reglas, **añade** este bloque dentro de `match /databases/{database}/documents { ... }`, sin borrar las reglas de Alabanzas:

```
match /doctrina/{documento=**} {
  allow read, write: if true;
}
```

Pulsa **Publicar**.

Ojo: con esta regla, cualquiera que tenga el enlace de la app puede ver y editar la lista. Comparte el enlace solo con los maestros. Más adelante se puede añadir un código o inicio de sesión.

## 3. Subirla a GitHub Pages
1. En tu repositorio `rito3d.github.io` crea una carpeta llamada `doctrina`.
2. Sube a esa carpeta los 6 archivos: `index.html`, `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png` y este LEEME.
3. En uno o dos minutos la app estará en **https://rito3d.github.io/doctrina/**

## 4. Instalarla en el celular de cada maestro
- **Android (Chrome):** abre el enlace › menú ⋮ › **Instalar aplicación** (o "Añadir a pantalla de inicio").
- **iPhone (Safari):** abre el enlace › botón Compartir › **Añadir a pantalla de inicio**.

La app aparece con su icono, se abre a pantalla completa sin barra del navegador y funciona sin internet. Lo que se guarde sin conexión se sube solo cuando vuelve la señal.

## Otros cursos
Al inicio del código está `const CURSO = 'discipulado-2026';`. Si para otro año o grupo cambias ese nombre, se crea un curso nuevo y vacío. El curso anterior queda guardado.
