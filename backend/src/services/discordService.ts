import axios from 'axios';

const DISCORD_API_URL = 'https://discord.com/api/v10';
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const FORUM_CHANNEL_ID = process.env.DISCORD_FORUM_CHANNEL_ID; // ID del canal tipo foro "tournaments"

interface DiscordEmbed {
  title: string;
  description?: string;
  color?: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  footer?: {
    text: string;
  };
  timestamp?: string;
}

interface DiscordMessage {
  content?: string;
  embeds?: DiscordEmbed[];
}

class DiscordService {
  private headers = {
    Authorization: `Bot ${BOT_TOKEN}`,
    'Content-Type': 'application/json',
  };

  /**
   * Crea un thread en el canal foro para un torneo
   */
  async createTournamentThread(
    tournamentId: string,
    tournamentName: string,
    tournamentType: string
  ): Promise<string> {
    if (!FORUM_CHANNEL_ID || !BOT_TOKEN) {
      console.warn('Discord credentials not configured, skipping thread creation');
      return '';
    }

    try {
      const threadName = `${tournamentName} [${tournamentType}]`.substring(0, 100);
      const payload = {
        name: threadName,
        auto_archive_duration: 10080, // 7 días
        message: {
          content: `Tournament created: **${threadName}**\n\nDiscussions and updates will be posted here.`,
        },
      };

      console.log(`📤 Enviando a Discord - Channel: ${FORUM_CHANNEL_ID}, Payload:`, JSON.stringify(payload));

      const response = await axios.post(
        `${DISCORD_API_URL}/channels/${FORUM_CHANNEL_ID}/threads`,
        payload,
        { headers: this.headers }
      );

      const threadId = response.data.id;
      console.log(`✅ Thread creado para torneo ${tournamentId}: ${threadId}`);
      return threadId;
    } catch (error: any) {
      console.error('❌ Error creando thread en Discord:', error.response?.data || error.message);
      if (error.response?.data?.errors) {
        console.error('Detalles de errores:', JSON.stringify(error.response.data.errors, null, 2));
      }
      return '';
    }
  }

  /**
   * Publica un mensaje en un thread de torneo
   */
  async publishTournamentMessage(
    threadId: string,
    message: DiscordMessage
  ): Promise<boolean> {
    if (!BOT_TOKEN || !threadId) {
      return false;
    }

    try {
      await axios.post(
        `${DISCORD_API_URL}/channels/${threadId}/messages`,
        message,
        { headers: this.headers }
      );
      return true;
    } catch (error) {
      console.error('Error publicando mensaje en Discord:', error);
      return false;
    }
  }

  /**
   * Torneo Creado
   */
  async postTournamentCreated(
    threadId: string,
    tournamentName: string,
    tournamentType: string,
    description: string,
    organizer: string,
    maxParticipants: number | null
  ): Promise<boolean> {
    const embed: DiscordEmbed = {
      title: `🎮 ${tournamentName}`,
      description: description,
      color: 0x3498db, // Azul
      fields: [
        {
          name: 'Tipo de Torneo',
          value: tournamentType,
          inline: true,
        },
        {
          name: 'Organizador',
          value: organizer,
          inline: true,
        },
        {
          name: 'Max Participantes',
          value: maxParticipants ? `${maxParticipants}` : 'Ilimitado',
          inline: true,
        },
        {
          name: 'Estado',
          value: '🔓 Inscripción Abierta',
          inline: true,
        },
      ],
      footer: {
        text: 'Torneo creado',
      },
      timestamp: new Date().toISOString(),
    };

    return this.publishTournamentMessage(threadId, { embeds: [embed] });
  }

  /**
   * Inscripción Abierta
   */
  async postRegistrationOpen(
    threadId: string,
    tournamentName: string
  ): Promise<boolean> {
    const embed: DiscordEmbed = {
      title: `🔓 Inscripciones Abiertas`,
      description: `Las inscripciones para **${tournamentName}** están abiertas.`,
      color: 0x2ecc71, // Verde
      footer: {
        text: 'Estado: Inscripción abierta',
      },
      timestamp: new Date().toISOString(),
    };

    return this.publishTournamentMessage(threadId, { embeds: [embed] });
  }

  /**
   * Jugador Inscrito
   */
  async postPlayerRegistered(
    threadId: string,
    playerNickname: string,
    currentCount: number,
    maxParticipants: number | null
  ): Promise<boolean> {
    const participantInfo = maxParticipants
      ? `${currentCount}/${maxParticipants}`
      : `${currentCount}`;

    const embed: DiscordEmbed = {
      title: `✅ Nuevo Participante`,
      description: `**${playerNickname}** se ha inscrito en el torneo.`,
      color: 0x3498db,
      fields: [
        {
          name: 'Participantes',
          value: participantInfo,
          inline: true,
        },
      ],
      footer: {
        text: 'Participante registrado',
      },
      timestamp: new Date().toISOString(),
    };

    return this.publishTournamentMessage(threadId, { embeds: [embed] });
  }

  /**
   * Jugador Aceptado
   */
  async postPlayerAccepted(
    threadId: string,
    playerNickname: string,
    totalAccepted: number
  ): Promise<boolean> {
    const embed: DiscordEmbed = {
      title: `👤 Participante Aceptado`,
      description: `**${playerNickname}** ha sido aceptado en el torneo.`,
      color: 0x27ae60, // Verde oscuro
      fields: [
        {
          name: 'Total Aceptados',
          value: `${totalAccepted}`,
          inline: true,
        },
      ],
      footer: {
        text: 'Participante aceptado',
      },
      timestamp: new Date().toISOString(),
    };

    return this.publishTournamentMessage(threadId, { embeds: [embed] });
  }

  /**
   * Inscripción Cerrada
   */
  async postRegistrationClosed(
    threadId: string,
    totalParticipants: number
  ): Promise<boolean> {
    const embed: DiscordEmbed = {
      title: `🔒 Inscripciones Cerradas`,
      description: `Las inscripciones han sido cerradas.`,
      color: 0xe74c3c, // Rojo
      fields: [
        {
          name: 'Total de Participantes',
          value: `${totalParticipants}`,
          inline: true,
        },
      ],
      footer: {
        text: 'Inscripciones cerradas',
      },
      timestamp: new Date().toISOString(),
    };

    return this.publishTournamentMessage(threadId, { embeds: [embed] });
  }

  /**
   * Torneo Iniciado
   */
  async postTournamentStarted(
    threadId: string,
    tournamentName: string,
    totalParticipants: number,
    totalRounds: number
  ): Promise<boolean> {
    const embed: DiscordEmbed = {
      title: `🚀 ¡Torneo Iniciado!`,
      description: `**${tournamentName}** ha comenzado.`,
      color: 0xf39c12, // Naranja
      fields: [
        {
          name: 'Participantes',
          value: `${totalParticipants}`,
          inline: true,
        },
        {
          name: 'Total de Rondas',
          value: `${totalRounds}`,
          inline: true,
        },
      ],
      footer: {
        text: 'Torneo iniciado',
      },
      timestamp: new Date().toISOString(),
    };

    return this.publishTournamentMessage(threadId, { embeds: [embed] });
  }

  /**
   * Ronda Iniciada
   */
  async postRoundStarted(
    threadId: string,
    roundNumber: number,
    matchesCount: number,
    endDate: string
  ): Promise<boolean> {
    const embed: DiscordEmbed = {
      title: `⏱️ Ronda ${roundNumber} Iniciada`,
      description: `La ronda ${roundNumber} ha comenzado.`,
      color: 0x9b59b6, // Púrpura
      fields: [
        {
          name: 'Partidas',
          value: `${matchesCount}`,
          inline: true,
        },
        {
          name: 'Vencimiento',
          value: endDate,
          inline: true,
        },
      ],
      footer: {
        text: `Ronda ${roundNumber}`,
      },
      timestamp: new Date().toISOString(),
    };

    return this.publishTournamentMessage(threadId, { embeds: [embed] });
  }

  /**
   * Cuadro de Emparejamientos
   */
  async postMatchups(
    threadId: string,
    roundNumber: number,
    matchups: Array<{ player1: string; player2: string }>
  ): Promise<boolean> {
    const matchupText = matchups
      .map((m, i) => `${i + 1}. **${m.player1}** vs **${m.player2}**`)
      .join('\n');

    const embed: DiscordEmbed = {
      title: `🎲 Cuadro de Emparejamientos - Ronda ${roundNumber}`,
      description: matchupText || 'Sin emparejamientos',
      color: 0x34495e, // Gris oscuro
      footer: {
        text: `Ronda ${roundNumber}`,
      },
      timestamp: new Date().toISOString(),
    };

    return this.publishTournamentMessage(threadId, { embeds: [embed] });
  }

  /**
   * Resultado de Partida Reportada
   */
  async postMatchResult(
    threadId: string,
    player1: string,
    player2: string,
    winner: string,
    map: string,
    faction: string
  ): Promise<boolean> {
    const embed: DiscordEmbed = {
      title: `🏆 Resultado - ${winner} Gana`,
      description: `**${player1}** vs **${player2}**`,
      color: 0x2ecc71, // Verde
      fields: [
        {
          name: 'Ganador',
          value: winner,
          inline: true,
        },
        {
          name: 'Mapa',
          value: map,
          inline: true,
        },
        {
          name: 'Facción',
          value: faction,
          inline: true,
        },
      ],
      footer: {
        text: 'Partida reportada',
      },
      timestamp: new Date().toISOString(),
    };

    return this.publishTournamentMessage(threadId, { embeds: [embed] });
  }

  /**
   * Fin de Ronda
   */
  async postRoundEnded(
    threadId: string,
    roundNumber: number
  ): Promise<boolean> {
    const embed: DiscordEmbed = {
      title: `✅ Ronda ${roundNumber} Finalizada`,
      description: `La ronda ${roundNumber} ha terminado.`,
      color: 0x27ae60, // Verde oscuro
      footer: {
        text: `Ronda ${roundNumber}`,
      },
      timestamp: new Date().toISOString(),
    };

    return this.publishTournamentMessage(threadId, { embeds: [embed] });
  }

  /**
   * Clasificados para la Siguiente Ronda
   */
  async postQualifiedPlayers(
    threadId: string,
    roundNumber: number,
    players: Array<{ nickname: string; points: number }>
  ): Promise<boolean> {
    const playerText = players
      .slice(0, 20) // Máximo 20 para no exceder límite de Discord
      .map((p, i) => `${i + 1}. **${p.nickname}** - ${p.points} pts`)
      .join('\n');

    const embed: DiscordEmbed = {
      title: `📊 Clasificación - Ronda ${roundNumber}`,
      description: playerText || 'Sin clasificados',
      color: 0x3498db, // Azul
      fields: [
        {
          name: 'Total',
          value: `${players.length} jugadores`,
          inline: true,
        },
      ],
      footer: {
        text: `Ronda ${roundNumber}`,
      },
      timestamp: new Date().toISOString(),
    };

    return this.publishTournamentMessage(threadId, { embeds: [embed] });
  }

  /**
   * Torneo Finalizado
   */
  async postTournamentFinished(
    threadId: string,
    tournamentName: string,
    winner: string,
    runnerUp: string
  ): Promise<boolean> {
    const embed: DiscordEmbed = {
      title: `🎉 ¡${tournamentName} Finalizado!`,
      description: `El torneo ha llegado a su fin.`,
      color: 0xf1c40f, // Amarillo
      fields: [
        {
          name: '🥇 Ganador',
          value: winner,
          inline: true,
        },
        {
          name: '🥈 Subcampeón',
          value: runnerUp || 'N/A',
          inline: true,
        },
      ],
      footer: {
        text: 'Torneo finalizado',
      },
      timestamp: new Date().toISOString(),
    };

    return this.publishTournamentMessage(threadId, { embeds: [embed] });
  }
}

export default new DiscordService();
