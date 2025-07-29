// engine.js - Versión Final Verificada

exports.handler = async function (event, context) {
  // Obtenemos la URL secreta de nuestro script de Google desde las variables de Netlify.
  const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;
  let response;

  try {
    // Verificamos qué tipo de petición es (GET o POST)
    if (event.httpMethod === "POST") {
      // Si es POST (para crear una reserva)...
      response = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: event.body, // Pasamos el cuerpo de la petición original (los datos del cliente)
      });

    } else { // Asumimos que es GET para todas las demás peticiones
      const queryString = new URLSearchParams(event.queryStringParameters).toString();
      const fullUrl = `${GOOGLE_SCRIPT_URL}?${queryString}`;
      response = await fetch(fullUrl);
    }

    // Obtenemos la respuesta de Google
    const data = await response.json();

    // Y se la devolvemos a nuestra app
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*", // Permitimos el acceso
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    };
    
  } catch (error) {
    // Si algo falla, devolvemos un error claro.
    return {
      statusCode: 500,
      body: JSON.stringify({ status: 'error', message: error.message }),
    };
  }
};
