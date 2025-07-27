// Este es el código de nuestra Función de Netlify.
// Actúa como un intermediario seguro entre nuestra app y Google.

exports.handler = async function (event, context) {
  // Obtenemos la URL secreta de nuestro script de Google desde las variables de Netlify.
  const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;

  // Reconstruimos la URL final con los parámetros que nos envía la app (action, propiedadId, etc.)
  const queryString = new URLSearchParams(event.queryStringParameters).toString();
  const fullUrl = `${GOOGLE_SCRIPT_URL}?${queryString}`;

  try {
    // La función hace la llamada a Google desde el servidor de Netlify.
    const response = await fetch(fullUrl);
    const data = await response.json();

    // Devuelve la respuesta de Google a nuestra app.
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*", // Permitir acceso
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    };
  } catch (error) {
    // Si algo falla, devuelve un error.
    return {
      statusCode: 500,
      body: JSON.stringify({ status: 'error', message: error.message }),
    };
  }
};