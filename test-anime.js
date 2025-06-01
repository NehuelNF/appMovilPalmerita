const { handler } = require('./netlify/functions/anime-episodes.js');

async function testAnimeFunction() {
  console.log('🧪 Probando función de anime episodes...\n');

  // Prueba 1: Obtener información del anime completo
  console.log('📚 Prueba 1: Información del anime "enen-no-shouboutai-san-no-shou"');
  try {
    const event1 = {
      httpMethod: 'GET',
      queryStringParameters: {
        animeSlug: 'enen-no-shouboutai-san-no-shou'
      }
    };
    
    const result1 = await handler(event1, {});
    const data1 = JSON.parse(result1.body);
    
    console.log('✅ Status:', result1.statusCode);
    console.log('📖 Título:', data1.title);
    console.log('📝 Descripción:', data1.description?.slice(0, 100) + '...');
    console.log('🎬 Total episodios:', data1.totalEpisodes);
    console.log('🎭 Géneros:', data1.genres?.slice(0, 3).join(', '));
    console.log('');
  } catch (error) {
    console.error('❌ Error en prueba 1:', error.message);
  }

  // Prueba 2: Obtener información de un episodio específico
  console.log('📺 Prueba 2: Episodio específico "enen-no-shouboutai-san-no-shou" episodio 9');
  try {
    const event2 = {
      httpMethod: 'GET',
      queryStringParameters: {
        animeSlug: 'enen-no-shouboutai-san-no-shou',
        episodeNumber: '9'
      }
    };
    
    const result2 = await handler(event2, {});
    const data2 = JSON.parse(result2.body);
    
    console.log('✅ Status:', result2.statusCode);
    console.log('📺 Título del episodio:', data2.title);
    console.log('🎌 Anime:', data2.animeTitle);
    console.log('🔗 Enlaces de video encontrados:', data2.videoSources?.length || 0);
    console.log('⬇️ Enlaces de descarga encontrados:', data2.downloadLinks?.length || 0);
    console.log('');
  } catch (error) {
    console.error('❌ Error en prueba 2:', error.message);
  }

  // Prueba 3: Probar con otro anime
  console.log('📚 Prueba 3: Información del anime "shoushimin-series"');
  try {
    const event3 = {
      httpMethod: 'GET',
      queryStringParameters: {
        animeSlug: 'shoushimin-series'
      }
    };
    
    const result3 = await handler(event3, {});
    const data3 = JSON.parse(result3.body);
    
    console.log('✅ Status:', result3.statusCode);
    console.log('📖 Título:', data3.title);
    console.log('🎬 Total episodios:', data3.totalEpisodes);
    console.log('');
  } catch (error) {
    console.error('❌ Error en prueba 3:', error.message);
  }

  console.log('🏁 Pruebas completadas');
}

testAnimeFunction();