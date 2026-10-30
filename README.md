# Gold Shine · Presupuestos (PWA)

App para armar presupuestos de pulido y restauración de ópticas, con PDF negro y dorado listo para compartir por WhatsApp. Funciona sin internet una vez instalada.

## Publicar en GitHub Pages (una sola vez)

1. En GitHub creá un repositorio nuevo (por ejemplo `gold-shine-presupuestos`), público.
2. Subí **el contenido de esta carpeta** (no la carpeta en sí) a la raíz del repositorio: `index.html`, `sw.js`, `manifest.webmanifest`, y las carpetas `css`, `js`, `img`, `fonts`, `vendor`.
3. En el repositorio: **Settings → Pages → Build and deployment**. En *Source* elegí **Deploy from a branch**, rama `main`, carpeta `/ (root)` y guardá.
4. Esperá uno o dos minutos. La app queda en `https://TU-USUARIO.github.io/gold-shine-presupuestos/`.

## Instalar en Android

1. Abrí esa dirección en **Chrome**.
2. Menú ⋮ → **Instalar aplicación** (o *Agregar a la pantalla principal*).
3. Se crea el ícono “Gold Shine”. Se abre a pantalla completa y anda sin conexión.

## Actualizar la app (cambios que hagas vos)

1. Editá los archivos en GitHub (lápiz ✏️ sobre el archivo) o subí los nuevos.
2. **Cambiá el número de `VERSION` en `sw.js`** (por ejemplo de `1.0.0` a `1.0.1`). Es lo que avisa a los teléfonos que hay algo nuevo.
3. Al abrir la app aparece el aviso **“Hay una versión nueva” → Actualizar**. También podés ir a *Ajustes → Buscar actualización*.

Tus presupuestos, plantillas y ajustes se guardan en el teléfono y **no se borran** al actualizar.

## Qué archivo tocar para cada cosa

| Quiero cambiar… | Archivo |
|---|---|
| Servicios y precios por defecto, estados de las ópticas | `js/data.js` |
| Datos de contacto, texto de cierre, numeración | `js/data.js` (o desde *Ajustes* en la app) |
| Diseño del PDF | `js/pdf.js` |
| Colores y estilo de la app | `css/styles.css` |
| Pantallas y funciones | `js/app.js` |

Para sumar una **plantilla nueva por defecto**, agregala en `BUILTIN_TEMPLATES` de `js/data.js` con un `id` que no se repita. Aparece sola en los teléfonos al actualizar (sin tocar las que ya editaste).

## Copias de seguridad

*Ajustes → Exportar copia* descarga un archivo con presupuestos, plantillas y ajustes. *Importar copia* lo restaura (por ejemplo en otro teléfono).

## Crédito

El PDF se genera con [pdf-lib](https://pdf-lib.js.org/) (licencia MIT, incluida en `vendor/`). Tipografía de la app: Poppins (SIL Open Font License).
