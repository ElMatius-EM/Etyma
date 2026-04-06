# Etyma
Этима (Etima) — Interpretador lingüístico del ruso 🇷🇺

Una aplicación web de cliente (Front-end) diseñada para estudiantes y apasionados de la lengua rusa y la lingüística. Permite realizar análisis profundos de etimología, evolución semántica y gramática comparativa (ruso-español) utilizando inteligencia artificial, además de contar con un diccionario integrado de más de 47.000 palabras.

## ✨ Características Principales

- **Análisis Lingüístico Profundo:** Obtén la transcripción fonética, traducción, raíces protoeslavas, y un desglose gramatical comparativo con el español de cualquier palabra rusa.
- **Diccionario Integrado:** Navega y filtra instantáneamente una base de datos local de miles de palabras usando un índice alfabético cirílico fluido.
- **Teclado Cirílico en Pantalla:** Ingresa caracteres rusos fácilmente sin necesidad de cambiar la configuración de tu sistema operativo.
- **Multimodelo IA:** Soporte integrado para conectar tu propia clave API y utilizar modelos de vanguardia:
  - DeepSeek V3.2
  - Google Gemini 2.5 Flash
  - Anthropic Claude Sonnet 3.5/4
- **Caché Local (IndexedDB):** Los análisis generados se guardan localmente en el navegador para consultas futuras instantáneas y sin costo de API.
- **100% Responsive:** Interfaz adaptable "pixel-perfect" desde monitores de escritorio hasta dispositivos móviles muy pequeños (menores a 400px).

## 🛠️ Tecnologías Utilizadas

- **HTML5 & CSS3:** Maquetación semántica y diseño puramente custom, sin frameworks externos. Uso intensivo de CSS Flexbox, Grid y variables nativas.
- **Vanilla JavaScript:** Lógica de estado, filtrado de arrays, manipulación del DOM e integración asíncrona con APIs de terceros sin librerías externas.
- **IndexedDB & LocalStorage:** Para persistencia de datos complejos (caché de palabras) y configuraciones del usuario (API keys, historial de búsqueda).

## 🚀 Uso e Instalación

El proyecto es 100% *Client-Side*. No requiere Node.js, bases de datos externas ni configuración de servidores.

1. **Clonar el repositorio:**
   \`\`\`bash
   git clone https://github.com/elmat/etima.git
   \`\`\`
2. **Abrir localmente:**
   Simplemente abre el archivo `index.html` en cualquier navegador web moderno.
3. **Configuración inicial (IA):**
   - Ve al ícono de engranaje (⚙️) en la esquina superior derecha.
   - Selecciona tu proveedor de IA preferido.
   - Ingresa tu API Key (esta clave se guarda **solo de manera local** en tu navegador por seguridad).

## 🔒 Privacidad y Seguridad

Por razones de seguridad arquitectónica, esta aplicación **no** actúa como un intermediario o proxy para las llamadas a la API. Las solicitudes HTTP se realizan directamente desde el navegador del cliente a los proveedores (Google, Anthropic, DeepSeek). 

Tus claves API no se comparten con ningún servidor central, almacenándose exclusivamente en el `localStorage` de tu navegador.

## 📝 Próximos pasos y mejoras (Roadmap)
- [x] Optimización de media queries para dispositivos móviles pequeños.
- [x] Índice de paginación y filtro alfabético nativo.
- [ ] Soporte para análisis de oraciones completas y sintaxis.

---
