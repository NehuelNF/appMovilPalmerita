import { Injectable } from '@angular/core';

export interface BroadcastInfo {
  day: string;
  time: string;
  timezone: string;
}

export interface ConvertedBroadcast {
  originalDay: string;
  originalTime: string;
  chileDay: string;
  chileTime: string;
  dayChanged: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TimezoneService {
  
  // Zona horaria de Chile (considerar horario de verano/invierno)
  private readonly CHILE_TIMEZONE = 'America/Santiago';
  private readonly JAPAN_TIMEZONE = 'Asia/Tokyo';
  
  // Mapeo de días en inglés a español
  private readonly DAY_TRANSLATIONS: { [key: string]: string } = {
    'monday': 'lunes',
    'tuesday': 'martes',
    'wednesday': 'miércoles', 
    'thursday': 'jueves',
    'friday': 'viernes',
    'saturday': 'sábado',
    'sunday': 'domingo',
    'mondays': 'lunes',
    'tuesdays': 'martes',
    'wednesdays': 'miércoles',
    'thursdays': 'jueves', 
    'fridays': 'viernes',
    'saturdays': 'sábados',
    'sundays': 'domingos'
  };

  // Mapeo de números de día (0=domingo, 1=lunes, etc.)
  private readonly DAY_NAMES_ES = [
    'domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'
  ];

  constructor() {}

  /**
   * Convierte información de broadcast japonés a hora chilena usando fechas reales
   * @param broadcastInfo Información de broadcast del anime
   * @param airedDate Fecha de estreno del anime para usar como referencia
   * @returns Información convertida a zona horaria de Chile
   */
  convertJapanBroadcastToChile(broadcastInfo: BroadcastInfo, airedDate?: string): ConvertedBroadcast {
    try {
      // Si tenemos fecha de estreno, usar ese día como referencia
      if (airedDate) {
        const result = this.calculateBroadcastFromAiredDate(airedDate, broadcastInfo);
        if (result) {
          return result;
        }
      }
      
      // Fallback al método anterior si no hay fecha de estreno
      return this.calculateBroadcastWithCurrentDate(broadcastInfo);

    } catch (error) {
      console.error('Error converting timezone:', error);
      
      // Fallback: retornar información original traducida
      return {
        originalDay: broadcastInfo.day,
        originalTime: broadcastInfo.time,
        chileDay: this.translateDay(broadcastInfo.day),
        chileTime: broadcastInfo.time,
        dayChanged: false
      };
    }
  }

  /**
   * Calcula el día de broadcast en Chile basándose en la fecha de estreno real
   */
  private calculateBroadcastFromAiredDate(airedDate: string, broadcastInfo: BroadcastInfo): ConvertedBroadcast {
    try {
      // Parsear la hora de broadcast
      const time = this.parseTime(broadcastInfo.time);
      
      // Obtener el día de la semana del broadcast japonés (0=domingo, 1=lunes, etc.)
      const japanDayNumber = this.getDayNumber(broadcastInfo.day);
      
      // CORRECCIÓN: Usar Intl.DateTimeFormat para obtener el día correcto en Chile
      const airDate = new Date(airedDate);
      
      // Usar el día de la fecha formateada para Chile
      const airedDayInChileName = new Intl.DateTimeFormat('es-CL', {
        timeZone: this.CHILE_TIMEZONE,
        weekday: 'long'
      }).format(airDate);
      
      // Obtener el número del día usando el nombre en español
      const correctAiredDayInChile = this.getDayNumberFromSpanishName(airedDayInChileName);
      
      // CORECCIÓN: Para animes que se emiten semanalmente, el día de broadcast 
      // generalmente es el mismo día de la semana que el estreno
      // Solo necesitamos encontrar la siguiente ocurrencia de ese día
      let dayDifference = 0;
      
      // Si el broadcast es el mismo día de la semana que el estreno
      if (japanDayNumber === correctAiredDayInChile) {
        // Verificar si necesitamos usar el mismo día o esperar a la próxima semana
        const airDateTime = new Date(airDate);
        const broadcastHour = time.hours;
        
        // Si la hora de broadcast ya pasó en el día de estreno, usar la siguiente semana
        if (airDateTime.getHours() > broadcastHour || 
           (airDateTime.getHours() === broadcastHour && airDateTime.getMinutes() >= time.minutes)) {
          // Ya pasó la hora de hoy, programar para la próxima semana
          dayDifference = 7;
        } else {
          dayDifference = 0; // Mismo día
        }
      } else {
        // Si es un día diferente, calcular la diferencia
        dayDifference = (japanDayNumber - correctAiredDayInChile + 7) % 7;
        // Si da 0 pero no son el mismo día, debe ser 7
        if (dayDifference === 0) {
          dayDifference = 7;
        }
      }
      
      // Crear la fecha del broadcast en Japón
      const japanBroadcastDate = new Date(airDate);
      japanBroadcastDate.setDate(airDate.getDate() + dayDifference);
      japanBroadcastDate.setHours(time.hours, time.minutes, 0, 0);
      
      // Crear fecha explícita en JST usando el offset correcto
      const year = japanBroadcastDate.getFullYear();
      const month = (japanBroadcastDate.getMonth() + 1).toString().padStart(2, '0');
      const day = japanBroadcastDate.getDate().toString().padStart(2, '0');
      const timeString = `${time.hours.toString().padStart(2, '0')}:${time.minutes.toString().padStart(2, '0')}`;
      
      // Crear fecha en JST (UTC+9)
      const japanBroadcastISO = `${year}-${month}-${day}T${timeString}:00+09:00`;
      const japanBroadcastTime = new Date(japanBroadcastISO);
      
      // Convertir a hora de Chile usando Intl.DateTimeFormat
      const chileOptions: Intl.DateTimeFormatOptions = {
        timeZone: this.CHILE_TIMEZONE,
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      };
      
      const chileFormatted = new Intl.DateTimeFormat('es-CL', chileOptions).formatToParts(japanBroadcastTime);
      
      const chileDay = chileFormatted.find(part => part.type === 'weekday')?.value || '';
      const chileHour = chileFormatted.find(part => part.type === 'hour')?.value || '00';
      const chileMinute = chileFormatted.find(part => part.type === 'minute')?.value || '00';
      const chileTime = `${chileHour}:${chileMinute}`;
      
      // Verificar si cambió el día comparando nombres de días
      const originalDayEs = this.translateDay(broadcastInfo.day);
      const dayChanged = originalDayEs.toLowerCase() !== chileDay.toLowerCase();
      
      return {
        originalDay: broadcastInfo.day,
        originalTime: broadcastInfo.time,
        chileDay,
        chileTime,
        dayChanged
      };

    } catch (error) {
      console.error('Error calculating broadcast from aired date:', error);
      throw error;
    }
  }

  /**
   * Calcula broadcast usando fecha actual como referencia
   */
  private calculateBroadcastWithCurrentDate(broadcastInfo: BroadcastInfo): ConvertedBroadcast {
    try {
      const japanDayNumber = this.getDayNumber(broadcastInfo.day);
      const time = this.parseTime(broadcastInfo.time);
      
      // Crear una fecha específica para el próximo día de broadcast en Japón
      const today = new Date();
      let daysUntilTarget = (japanDayNumber - today.getDay() + 7) % 7;
      
      // Si es 0 y no es el día actual, usar la próxima semana
      if (daysUntilTarget === 0 && today.getDay() === japanDayNumber) {
        // Es el día actual, mantener 0
      } else if (daysUntilTarget === 0) {
        daysUntilTarget = 7;
      }
      
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + daysUntilTarget);
      
      // Crear la fecha y hora específica en JST (UTC+9)
      // Usamos el año, mes y día calculados, con la hora específica
      const year = targetDate.getFullYear();
      const month = (targetDate.getMonth() + 1).toString().padStart(2, '0');
      const day = targetDate.getDate().toString().padStart(2, '0');
      const timeString = `${time.hours.toString().padStart(2, '0')}:${time.minutes.toString().padStart(2, '0')}`;
      
      // Crear una fecha explícita en JST (UTC+9)
      const japanDateTimeISO = `${year}-${month}-${day}T${timeString}:00+09:00`;
      const japanDateTime = new Date(japanDateTimeISO);
      
      // Convertir a hora de Chile usando Intl.DateTimeFormat
      const chileOptions: Intl.DateTimeFormatOptions = {
        timeZone: this.CHILE_TIMEZONE,
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      };
      
      const chileFormatted = new Intl.DateTimeFormat('es-CL', chileOptions).formatToParts(japanDateTime);
      
      const chileDay = chileFormatted.find(part => part.type === 'weekday')?.value || '';
      const chileHour = chileFormatted.find(part => part.type === 'hour')?.value || '00';
      const chileMinute = chileFormatted.find(part => part.type === 'minute')?.value || '00';
      const chileTime = `${chileHour}:${chileMinute}`;
      
      // Verificar si cambió el día comparando nombres de días
      const originalDayEs = this.translateDay(broadcastInfo.day);
      const dayChanged = originalDayEs.toLowerCase() !== chileDay.toLowerCase();
      
      return {
        originalDay: broadcastInfo.day,
        originalTime: broadcastInfo.time,
        chileDay,
        chileTime,
        dayChanged
      };

    } catch (error) {
      console.error('Error calculating broadcast with current date:', error);
      return {
        originalDay: broadcastInfo.day,
        originalTime: broadcastInfo.time,
        chileDay: this.translateDay(broadcastInfo.day),
        chileTime: broadcastInfo.time,
        dayChanged: false
      };
    }
  }

  /**
   * Sincroniza la fecha de estreno para que coincida con el día de broadcast en Chile
   * Esta función hace que el día de estreno sea el mismo día que se emite en Chile
   */
  synchronizeAiredDateWithBroadcast(airedDate: string, broadcastInfo: BroadcastInfo): {
    originalDate: string;
    synchronizedDate: string;
    chileDay: string;
    chileTime: string;
    wasSynchronized: boolean;
    explanation: string;
  } {
    try {
      const originalAiredDate = new Date(airedDate);
      const convertedBroadcast = this.convertJapanBroadcastToChile(broadcastInfo, airedDate);

      // Obtener el día de la semana del broadcast en Chile
      const chileDayNumber = this.getDayOfWeekNumber(convertedBroadcast.chileDay);
      
      if (chileDayNumber === null) {
        return {
          originalDate: airedDate,
          synchronizedDate: airedDate,
          chileDay: convertedBroadcast.chileDay,
          chileTime: convertedBroadcast.chileTime,
          wasSynchronized: false,
          explanation: 'No se pudo sincronizar por día inválido'
        };
      }

      // Calcular la fecha más cercana que coincida con el día de broadcast en Chile
      const synchronizedDate = new Date(originalAiredDate);
      const currentDay = synchronizedDate.getDay();
      const daysToAdd = (chileDayNumber - currentDay + 7) % 7;
      
      synchronizedDate.setDate(synchronizedDate.getDate() + daysToAdd);

      const wasSynchronized = daysToAdd !== 0;
      
      return {
        originalDate: airedDate,
        synchronizedDate: synchronizedDate.toISOString(),
        chileDay: convertedBroadcast.chileDay,
        chileTime: convertedBroadcast.chileTime,
        wasSynchronized,
        explanation: wasSynchronized 
          ? `Fecha sincronizada para coincidir con emisión los ${convertedBroadcast.chileDay} en Chile`
          : `Fecha ya coincide con emisión los ${convertedBroadcast.chileDay} en Chile`
      };
    } catch (error) {
      console.error('Error sincronizando fecha con broadcast:', error);
      return {
        originalDate: airedDate,
        synchronizedDate: airedDate,
        chileDay: this.translateDay(broadcastInfo.day),
        chileTime: broadcastInfo.time || '00:00',
        wasSynchronized: false,
        explanation: 'Error en la sincronización'
      };
    }
  }

  private getDayOfWeekNumber(dayName: string): number | null {
    const days: { [key: string]: number } = {
      'lunes': 1,
      'martes': 2,
      'miércoles': 3,
      'jueves': 4,
      'viernes': 5,
      'sábado': 6,
      'domingo': 0
    };
    return days[dayName.toLowerCase()] || null;
  }

  /**
   * Obtiene el número del día (0-6) a partir del nombre en español
   */
  private getDayNumberFromSpanishName(dayNameSpanish: string): number {
    const normalizedName = dayNameSpanish.toLowerCase().trim();
    const index = this.DAY_NAMES_ES.findIndex(day => day.toLowerCase() === normalizedName);
    return index !== -1 ? index : 0; // Default a domingo si no se encuentra
  }

  /**
   * Agrega el offset de zona horaria japonesa a una fecha
   */
  private addJapanTimezoneOffset(date: Date): Date {
    // Japón está en UTC+9, así que agregamos 9 horas
    // Pero necesitamos considerar que Date ya puede tener un offset local
    const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000);
    const japanTime = new Date(utcTime + (9 * 3600000)); // +9 horas para JST
    return japanTime;
  }

  /**
   * Convierte una fecha de estreno de JST a hora chilena con mejor precisión
   * @param dateString Fecha en formato ISO string
   * @returns Fecha convertida a zona horaria de Chile
   */
  convertAiredDateToChile(dateString: string): Date {
    try {
      let date = new Date(dateString);
      
      // Si la fecha no tiene información de timezone, asumimos que es JST
      if (!dateString.includes('T') || (!dateString.includes('+') && !dateString.includes('Z'))) {
        // Tratar como fecha en JST
        date = this.addJapanTimezoneOffset(date);
      }
      
      return date;
    } catch (error) {
      console.error('Error converting aired date:', error);
      return new Date(dateString);
    }
  }

  /**
   * Formatea una fecha para mostrar en zona horaria de Chile
   * @param date Fecha a formatear
   * @returns Fecha formateada en español chileno
   */
  formatDateForChile(date: Date): string {
    return new Intl.DateTimeFormat('es-CL', {
      timeZone: this.CHILE_TIMEZONE,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    }).format(date);
  }

  /**
   * Traduce un día de la semana del inglés al español
   */
  translateDay(day: string): string {
    const normalizedDay = day.toLowerCase().trim();
    return this.DAY_TRANSLATIONS[normalizedDay] || day;
  }

  /**
   * Obtiene el número del día de la semana (0=domingo, 1=lunes, etc.)
   */
  private getDayNumber(day: string): number {
    // Limpiar y normalizar el string del día
    const normalizedDay = day.toLowerCase().trim().replace(/s$/, ''); // remover 's' al final si existe
    
    const dayMap: { [key: string]: number } = {
      'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
      'thursday': 4, 'friday': 5, 'saturday': 6
    };
    
    const result = dayMap[normalizedDay];
    
    return result !== undefined ? result : 0;
  }

  /**
   * Parsea una string de tiempo en formato HH:MM
   */
  private parseTime(timeString: string): { hours: number; minutes: number } {
    const defaultTime = { hours: 0, minutes: 0 };
    
    if (!timeString) return defaultTime;
    
    // Limpiar y normalizar el string de tiempo
    const cleanTime = timeString.replace(/[^\d:]/g, '');
    const parts = cleanTime.split(':');
    
    if (parts.length >= 2) {
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      
      if (!isNaN(hours) && !isNaN(minutes)) {
        return {
          hours: Math.max(0, Math.min(23, hours)),
          minutes: Math.max(0, Math.min(59, minutes))
        };
      }
    }
    
    // Si solo hay un número, asumir que son horas
    if (parts.length === 1) {
      const hours = parseInt(parts[0], 10);
      if (!isNaN(hours)) {
        return {
          hours: Math.max(0, Math.min(23, hours)),
          minutes: 0
        };
      }
    }
    
    return defaultTime;
  }

  /**
   * Obtiene información sobre el cambio de zona horaria para mostrar al usuario
   */
  getTimezoneInfo(broadcastInfo: BroadcastInfo, airedDate?: string): string {
    const converted = this.convertJapanBroadcastToChile(broadcastInfo, airedDate);
    
    if (converted.dayChanged) {
      return `Originalmente ${this.translateDay(converted.originalDay)} en Japón, ${converted.chileDay} en Chile`;
    }
    
    return `${converted.chileDay} en horario de Chile`;
  }

  /**
   * Calcula la diferencia horaria actual entre Japón y Chile
   */
  getCurrentTimezoneOffset(): number {
    const now = new Date();
    
    // Crear fechas en ambas zonas horarias
    const japanTime = new Date(now.toLocaleString("en-US", {timeZone: this.JAPAN_TIMEZONE}));
    const chileTime = new Date(now.toLocaleString("en-US", {timeZone: this.CHILE_TIMEZONE}));
    
    // Calcular la diferencia en horas
    const diffInMilliseconds = japanTime.getTime() - chileTime.getTime();
    return diffInMilliseconds / (1000 * 60 * 60);
  }
}