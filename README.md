# Etyma

**Этима (Etima)** — Interpretador lingüístico del ruso 🇷🇺

Aplicación web para estudiantes y apasionados de la lengua rusa. Combina análisis lingüístico profundo con IA (etimología, evolución semántica, gramática comparativa ruso-español) y un diccionario integrado de más de 47.000 palabras.

🔗 **[Probalo acá](https://elmat.github.io/etima/)**

---

## ✨ Características principales

- **Análisis lingüístico profundo**: Transcripción fonética IPA, traducción, raíces protoeslavas, evolución histórica y desglose gramatical comparativo con el español de cualquier palabra rusa.
- **Diccionario integrado**: Más de 47.000 palabras precargadas con índice alfabético cirílico fluido y filtrado instantáneo.
- **Teclado cirílico en pantalla**: Ingresá caracteres rusos sin cambiar la configuración del sistema.
- **Autenticación y suscripciones**: Login con email o Google vía Firebase. Suscripción mensual de USD 2.49 procesada por Lemon Squeezy.
- **Modo avanzado (BYOK)**: Los usuarios pueden conectar su propia clave API de DeepSeek, Gemini o Claude en vez de suscribirse.
- **Caché local (IndexedDB)**: Los análisis generados se guardan en el navegador para consultas instantáneas y sin costo.
- **100% responsive**: Interfaz adaptable desde desktop hasta móviles de menos de 400px.

---

## 🏗️ Arquitectura

El proyecto combina un frontend estático con un backend liviano (Cloudflare Worker) que actúa como proxy seguro hacia DeepSeek y como verificador de suscripciones.

| Componente | Tecnología | Función |
|---|---|---|
| Frontend | HTML + CSS + Vanilla JS | Interfaz, caché, teclado cirílico, diccionario |
| Auth | Firebase Authentication | Login con email y Google |
| Base de datos | Firebase Firestore | Estado de suscripción y log de uso |
| Proxy / API | Cloudflare Workers | Intermediario seguro frontend ↔ DeepSeek |
| IA | DeepSeek V3 (`deepseek-chat`) | Generación del análisis lingüístico |
| Pagos | Lemon Squeezy | Suscripción mensual + webhooks |
| Caché local | IndexedDB + `words.json` | Palabras precargadas y análisis cacheados |

### Flujo de análisis

Cuando un usuario solicita el análisis de una palabra, la app sigue este orden:

1. Busca la palabra en caché local (IndexedDB). Si está, la muestra sin llamar a ninguna API.
2. Si el usuario tiene clave API propia configurada, llama directo al proveedor (modo avanzado).
3. Si el usuario tiene suscripción activa, llama al Cloudflare Worker, que verifica el JWT de Firebase, chequea el estado de suscripción en Firestore y hace de proxy hacia DeepSeek.
4. Si no tiene suscripción, muestra el modal de suscripción.
5. Si no tiene sesión iniciada, muestra el modal de login.

### Endpoints del Worker

- `POST /create-user` — Crea el documento del usuario en Firestore al registrarse.
- `GET /status` — Devuelve el estado de suscripción del usuario autenticado.
- `POST /analyze` — Verifica suscripción, llama a DeepSeek y retorna el análisis.
- `POST /webhook` — Recibe eventos de Lemon Squeezy (`subscription_created`, `updated`, `cancelled`, `expired`) con verificación HMAC.

---

## 🔒 Seguridad

- Todas las claves sensibles (API key de DeepSeek, service account de Firebase, signing secret de Lemon Squeezy) viven exclusivamente como secrets del Worker en Cloudflare.
- El Worker verifica criptográficamente los JWT de Firebase contra las claves públicas de Google antes de procesar cualquier request.
- Las reglas de Firestore impiden que un usuario lea o escriba datos de otro. El log de uso y las compras solo pueden ser escritas por el Worker (vía service account).
- Los webhooks de Lemon Squeezy se validan con firma HMAC-SHA256 para rechazar requests falsificados.
- Las claves API propias (modo BYOK) se guardan únicamente en el `localStorage` del navegador del usuario. Nunca salen del cliente.

---

## 🛠️ Stack técnico

- **HTML5 + CSS3**: Maquetación semántica, diseño custom sin frameworks. Flexbox, Grid y variables CSS.
- **Vanilla JavaScript**: Sin librerías externas para la lógica de la app.
- **Firebase SDK v10**: Auth + Firestore vía módulos ES6.
- **Cloudflare Workers**: Runtime V8 edge con WebCrypto API para verificación de JWT, firmado de tokens de servicio y validación de webhooks.
- **IndexedDB + LocalStorage**: Persistencia de caché y preferencias.

---

## 📝 Roadmap

- [ ] Soporte para análisis de oraciones completas y sintaxis.
- [ ] Exportar historial de palabras consultadas a PDF.
- [ ] Modo offline completo (PWA).
- [ ] Índice de paginación nativa para el diccionario.
- [ ] Integración con Anki para flashcards.

---

## 📄 Licencia

Proyecto personal. Todos los derechos reservados.
