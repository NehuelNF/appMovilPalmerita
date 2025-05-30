const cheerio = require('cheerio');
const axios = require('axios');

exports.handler = async (event, context) => {
  // Configurar CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  try {
    console.log('🔍 Iniciando scraping de Somos Kudasai...');
    
    const response = await axios.get('https://somoskudasai.com/noticias/anime/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 15000,
      maxRedirects: 5
    });

    const $ = cheerio.load(response.data);
    const noticias = [];

    // Intentar múltiples selectores para diferentes estructuras de la página
    const selectors = [
      'article',
      '.post',
      '.entry',
      '.news-item',
      '.post-item',
      '[class*="post"]',
      '[class*="article"]'
    ];

    let found = false;
    for (const selector of selectors) {
      $(selector).each((index, element) => {
        if (index >= 12) return false; // Limitar a 12 noticias

        const $el = $(element);
        
        // Múltiples formas de encontrar el título
        const titulo = $el.find('h2 a, h3 a, h1 a, .title a, .post-title a, [class*="title"] a')
          .first().text().trim() || 
          $el.find('h2, h3, h1, .title, .post-title, [class*="title"]')
          .first().text().trim();

        // Múltiples formas de encontrar el URL
        const url = $el.find('h2 a, h3 a, h1 a, .title a, .post-title a, [class*="title"] a')
          .first().attr('href') ||
          $el.find('a').first().attr('href');

        // Múltiples formas de encontrar la descripción
        const descripcion = $el.find('.excerpt, .summary, p, .content, .description')
          .first().text().trim().slice(0, 200) ||
          $el.text().trim().slice(0, 200);

        // Múltiples formas de encontrar la imagen
        let imagen = $el.find('img').first().attr('src') || 
                    $el.find('img').first().attr('data-src') ||
                    $el.find('img').first().attr('data-lazy-src');
        
        // Asegurar URLs absolutas
        if (imagen && !imagen.startsWith('http')) {
          if (imagen.startsWith('//')) {
            imagen = `https:${imagen}`;
          } else if (imagen.startsWith('/')) {
            imagen = `https://somoskudasai.com${imagen}`;
          } else {
            imagen = `https://somoskudasai.com/${imagen}`;
          }
        }
        
        let fullUrl = url;
        if (url && !url.startsWith('http')) {
          if (url.startsWith('/')) {
            fullUrl = `https://somoskudasai.com${url}`;
          } else {
            fullUrl = `https://somoskudasai.com/${url}`;
          }
        }

        // Solo agregar si tiene título válido
        if (titulo && titulo.length > 5 && !titulo.toLowerCase().includes('cookie')) {
          noticias.push({
            titulo: titulo.slice(0, 100), // Limitar longitud
            descripcion: descripcion || 'Última noticia de anime desde Somos Kudasai',
            imagen: imagen || 'https://picsum.photos/300/200?random=' + Math.floor(Math.random() * 1000),
            fecha: new Date().toISOString(),
            url: fullUrl || 'https://somoskudasai.com',
            categoria: 'Anime',
            autor: 'Somos Kudasai'
          });
          found = true;
        }
      });

      if (found && noticias.length > 0) break; // Si encontramos noticias, no probar más selectores
    }

    console.log(`✅ Encontradas ${noticias.length} noticias`);

    // Si no encontramos noticias, devolver noticias de ejemplo
    if (noticias.length === 0) {
      console.log('⚠️ No se encontraron noticias, devolviendo contenido de ejemplo');
      const noticiasEjemplo = [
        {
          titulo: "Demon Slayer: Nuevo arco animado confirmado",
          descripcion: "El estudio Ufotable confirma la animación del próximo arco de Demon Slayer con nueva fecha de estreno para 2024.",
          imagen: "https://picsum.photos/300/200?random=" + Math.floor(Math.random() * 1000),
          fecha: new Date().toISOString(),
          url: "https://somoskudasai.com",
          categoria: "Anime",
          autor: "Somos Kudasai"
        },
        {
          titulo: "Attack on Titan: Película final anunciada",
          descripcion: "Wit Studio anuncia una película que adaptará los últimos capítulos del manga de Attack on Titan.",
          imagen: "https://picsum.photos/300/200?random=" + Math.floor(Math.random() * 1000),
          fecha: new Date(Date.now() - 3600000).toISOString(),
          url: "https://somoskudasai.com",
          categoria: "Anime",
          autor: "Somos Kudasai"
        },
        {
          titulo: "One Piece: Nuevo opening revelado",
          descripcion: "Toei Animation revela el nuevo opening de One Piece que acompañará el arco currente.",
          imagen: "https://picsum.photos/300/200?random=" + Math.floor(Math.random() * 1000),
          fecha: new Date(Date.now() - 7200000).toISOString(),
          url: "https://somoskudasai.com",
          categoria: "Anime",
          autor: "Somos Kudasai"
        }
      ];
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(noticiasEjemplo)
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(noticias.slice(0, 10)) // Limitar a 10 noticias
    };

  } catch (error) {
    console.error('❌ Error en scraping:', error.message);
    
    // Devolver noticias de fallback en caso de error
    const fallbackNoticias = [
      {
        titulo: "Servicio de noticias en mantenimiento",
        descripcion: "Las noticias no están disponibles temporalmente. Intenta nuevamente en unos minutos.",
        imagen: "https://picsum.photos/300/200?random=" + Math.floor(Math.random() * 1000),
        fecha: new Date().toISOString(),
        url: "https://somoskudasai.com",
        categoria: "Sistema",
        autor: "App Palmerita"
      },
      {
        titulo: "¡Mantente al día con el anime!",
        descripcion: "Visita Somos Kudasai para las últimas noticias del mundo del anime y manga.",
        imagen: "https://picsum.photos/300/200?random=" + Math.floor(Math.random() * 1000),
        fecha: new Date().toISOString(),
        url: "https://somoskudasai.com",
        categoria: "Anime",
        autor: "Somos Kudasai"
      }
    ];
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(fallbackNoticias)
    };
  }
};