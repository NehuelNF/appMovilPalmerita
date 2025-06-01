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
    // Obtener parámetros de la URL
    const { animeSlug, episodeNumber } = event.queryStringParameters || {};
    
    if (!animeSlug) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Se requiere el parámetro animeSlug' })
      };
    }

    console.log(`🔍 Iniciando scraping de AnimeFlv para: ${animeSlug}`);
    
    let url;
    let scrapeType;
    
    // Si se proporciona episodeNumber, buscar información del episodio específico
    if (episodeNumber) {
      url = `https://www3.animeflv.net/ver/${animeSlug}-${episodeNumber}`;
      scrapeType = 'episode';
      console.log(`📺 Buscando episodio ${episodeNumber} de ${animeSlug}`);
    } else {
      // Si no se proporciona episodeNumber, buscar información general del anime
      url = `https://www3.animeflv.net/anime/${animeSlug}`;
      scrapeType = 'anime';
      console.log(`📚 Buscando información general de ${animeSlug}`);
    }

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Referer': 'https://www3.animeflv.net/',
      },
      timeout: 20000,
      maxRedirects: 5
    });

    const $ = cheerio.load(response.data);
    
    if (scrapeType === 'episode') {
      // Scraping para episodio específico
      const episodeData = scrapeEpisode($, animeSlug, episodeNumber);
      
      if (!episodeData.title) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ 
            error: 'Episodio no encontrado',
            message: `No se pudo encontrar el episodio ${episodeNumber} de ${animeSlug}`
          })
        };
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(episodeData)
      };
      
    } else {
      // Scraping para información del anime y lista de episodios
      const animeData = scrapeAnimeInfo($, animeSlug);
      
      if (!animeData.title) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ 
            error: 'Anime no encontrado',
            message: `No se pudo encontrar el anime ${animeSlug}`
          })
        };
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(animeData)
      };
    }

  } catch (error) {
    console.error('❌ Error en scraping de AnimeFlv:', error.message);
    
    // Manejar diferentes tipos de errores
    if (error.response?.status === 404) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          error: 'Contenido no encontrado',
          message: 'El anime o episodio solicitado no existe'
        })
      };
    }
    
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return {
        statusCode: 408,
        headers,
        body: JSON.stringify({ 
          error: 'Timeout',
          message: 'La petición tardó demasiado tiempo en responder'
        })
      };
    }
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Error interno del servidor',
        message: 'No se pudo procesar la solicitud'
      })
    };
  }
};

// Función para hacer scraping de un episodio específico
function scrapeEpisode($, animeSlug, episodeNumber) {
  const episodeData = {
    animeSlug,
    episodeNumber: parseInt(episodeNumber),
    title: '',
    animeTitle: '',
    description: '',
    thumbnail: '',
    videoSources: [],
    downloadLinks: [],
    nextEpisode: null,
    previousEpisode: null,
    timestamp: new Date().toISOString()
  };

  try {
    // Título del episodio y anime
    episodeData.title = $('.anime_title h1').text().trim() || 
                       $('h1.Title').text().trim() || 
                       $('title').text().trim();
    
    episodeData.animeTitle = $('.anime_title h2 a').text().trim() ||
                            $('.breadcrumb a:last-child').text().trim();

    // Descripción
    episodeData.description = $('.Description p').text().trim() ||
                             $('.sinopsis').text().trim() ||
                             'Episodio de anime';

    // Thumbnail/imagen
    let thumbnail = $('.anime_img img').attr('src') ||
                   $('.Image img').attr('src') ||
                   $('meta[property="og:image"]').attr('content');
    
    if (thumbnail && !thumbnail.startsWith('http')) {
      thumbnail = `https://www3.animeflv.net${thumbnail}`;
    }
    episodeData.thumbnail = thumbnail || '';

    // Enlaces de video (estos pueden estar en scripts o iframes)
    $('iframe').each((i, el) => {
      const src = $(el).attr('src');
      if (src && (src.includes('video') || src.includes('player'))) {
        episodeData.videoSources.push({
          type: 'iframe',
          url: src,
          quality: 'unknown'
        });
      }
    });

    // Enlaces de descarga
    $('.DownloadList a, .download-link a').each((i, el) => {
      const $link = $(el);
      const url = $link.attr('href');
      const quality = $link.text().trim();
      
      if (url) {
        episodeData.downloadLinks.push({
          url: url.startsWith('http') ? url : `https://www3.animeflv.net${url}`,
          quality: quality || 'Desconocida',
          format: url.includes('.mp4') ? 'MP4' : 'Desconocido'
        });
      }
    });

    // Episodio anterior y siguiente
    $('.episode-nav a, .navigation a').each((i, el) => {
      const $link = $(el);
      const href = $link.attr('href');
      const text = $link.text().toLowerCase();
      
      if (href && href.includes('/ver/')) {
        const episodeMatch = href.match(/-(\d+)$/);
        if (episodeMatch) {
          const epNum = parseInt(episodeMatch[1]);
          
          if (text.includes('anterior') || text.includes('prev')) {
            episodeData.previousEpisode = {
              episodeNumber: epNum,
              url: `https://www3.animeflv.net${href}`
            };
          } else if (text.includes('siguiente') || text.includes('next')) {
            episodeData.nextEpisode = {
              episodeNumber: epNum,
              url: `https://www3.animeflv.net${href}`
            };
          }
        }
      }
    });

    console.log(`✅ Episodio ${episodeNumber} procesado: ${episodeData.title}`);
    
  } catch (error) {
    console.error('Error procesando episodio:', error);
  }

  return episodeData;
}

// Función para hacer scraping de información del anime y lista de episodios
function scrapeAnimeInfo($, animeSlug) {
  const animeData = {
    slug: animeSlug,
    title: '',
    alternativeTitles: [],
    description: '',
    thumbnail: '',
    status: '',
    type: '',
    genres: [],
    year: '',
    studio: '',
    episodes: [],
    totalEpisodes: 0,
    rating: '',
    timestamp: new Date().toISOString()
  };

  try {
    // Título principal - selectores más específicos para AnimeFlv
    animeData.title = $('.Anime h1.Title, h1.Title, .anime-title h1, .title h1').first().text().trim() ||
                     $('h1').first().text().trim() ||
                     $('title').text().replace(' - AnimeFlv', '').trim();

    // Títulos alternativos
    $('.TitlesAnime span, .alt-title, .alternative-title').each((i, el) => {
      const altTitle = $(el).text().trim();
      if (altTitle && altTitle !== animeData.title) {
        animeData.alternativeTitles.push(altTitle);
      }
    });

    // Descripción/sinopsis - selectores actualizados
    animeData.description = $('.Description p, .description p, .sinopsis, .anime-description, .overview').first().text().trim() ||
                           $('.Description, .description, .anime-info .text').first().text().trim();

    // Imagen/thumbnail - selectores más específicos
    let thumbnail = $('.anime-poster img, .Anime .Image img, .anime-image img, .poster img').attr('src') ||
                   $('.anime-cover img, .cover img').attr('src') ||
                   $('meta[property="og:image"]').attr('content');
    
    if (thumbnail && !thumbnail.startsWith('http')) {
      thumbnail = `https://www3.animeflv.net${thumbnail}`;
    }
    animeData.thumbnail = thumbnail || '';

    // Información adicional del anime
    $('.anime-info p, .info-item, .anime-details .item').each((i, el) => {
      const $p = $(el);
      const text = $p.text().toLowerCase();
      const labelText = $p.find('.info-label, .label, strong, b').text().toLowerCase();
      const valueText = $p.find('.info-value, .value').text().trim() || 
                       $p.text().replace($p.find('.info-label, .label, strong, b').text(), '').trim();

      if (text.includes('estado') || labelText.includes('estado') || text.includes('status')) {
        animeData.status = valueText || $p.find('span').last().text().trim();
      } else if (text.includes('tipo') || labelText.includes('tipo') || text.includes('type')) {
        animeData.type = valueText || $p.find('span').last().text().trim();
      } else if (text.includes('año') || labelText.includes('año') || text.includes('year')) {
        animeData.year = valueText || $p.find('span').last().text().trim();
      } else if (text.includes('estudio') || labelText.includes('estudio') || text.includes('studio')) {
        animeData.studio = valueText || $p.find('span').last().text().trim();
      } else if (text.includes('puntuación') || labelText.includes('rating') || text.includes('score')) {
        animeData.rating = valueText || $p.find('span').last().text().trim();
      }
    });

    // Géneros - selectores actualizados
    $('.anime-genres a, .genres a, .genre a, .Genres a').each((i, el) => {
      const genre = $(el).text().trim();
      if (genre && !animeData.genres.includes(genre)) {
        animeData.genres.push(genre);
      }
    });

    // Lista de episodios - selectores más específicos para AnimeFlv
    const episodeSelectors = [
      '.episode-list li a',
      '.episodes-list li a', 
      '.episodios li a',
      '.ListCaps li a',
      '.list-episodes li a',
      'ul.episodios li a',
      '.episode-item a',
      'li[class*="episode"] a'
    ];

    let episodeFound = false;
    for (const selector of episodeSelectors) {
      $(selector).each((i, el) => {
        const $link = $(el);
        const episodeUrl = $link.attr('href');
        const episodeText = $link.text().trim();
        
        if (episodeUrl && episodeUrl.includes('/ver/')) {
          // Extraer número de episodio de la URL
          const episodeMatch = episodeUrl.match(/-(\d+)$/);
          if (episodeMatch) {
            const episodeNumber = parseInt(episodeMatch[1]);
            const episodeTitle = episodeText || `Episodio ${episodeNumber}`;
            
            // Evitar duplicados
            const exists = animeData.episodes.find(ep => ep.number === episodeNumber);
            if (!exists) {
              animeData.episodes.push({
                number: episodeNumber,
                title: episodeTitle,
                url: episodeUrl.startsWith('http') ? episodeUrl : `https://www3.animeflv.net${episodeUrl}`,
                slug: `${animeSlug}-${episodeNumber}`
              });
              episodeFound = true;
            }
          }
        }
      });
      
      if (episodeFound) break; // Si encontramos episodios con un selector, no probar más
    }

    // Si no encontramos episodios con los selectores anteriores, intentar método alternativo
    if (!episodeFound) {
      // Buscar en scripts o datos JSON embebidos
      $('script').each((i, el) => {
        const scriptContent = $(el).html();
        if (scriptContent && (scriptContent.includes('episodes') || scriptContent.includes('episodios'))) {
          // Intentar extraer información de episodios del JavaScript
          const episodeMatches = scriptContent.match(/(\d+)/g);
          if (episodeMatches) {
            // Tomar los últimos números como posibles episodios
            const possibleEpisodes = episodeMatches.slice(-10).map(num => parseInt(num)).filter(num => num > 0 && num <= 500);
            possibleEpisodes.forEach(epNum => {
              if (!animeData.episodes.find(ep => ep.number === epNum)) {
                animeData.episodes.push({
                  number: epNum,
                  title: `Episodio ${epNum}`,
                  url: `https://www3.animeflv.net/ver/${animeSlug}-${epNum}`,
                  slug: `${animeSlug}-${epNum}`
                });
              }
            });
          }
        }
      });
    }

    // Ordenar episodios por número
    animeData.episodes.sort((a, b) => a.number - b.number);
    animeData.totalEpisodes = animeData.episodes.length;

    console.log(`✅ Anime procesado: ${animeData.title} (${animeData.totalEpisodes} episodios)`);
    if (animeData.genres.length > 0) {
      console.log(`🎭 Géneros encontrados: ${animeData.genres.join(', ')}`);
    }
    
  } catch (error) {
    console.error('Error procesando anime:', error);
  }

  return animeData;
}