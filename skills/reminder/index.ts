import type { SkillModule } from '../../src/types/skill.js';

interface Reminder {
  id: string;
  message: string;
  time: Date;
  sessionId: string;
  timer?: ReturnType<typeof setTimeout>;
}

const reminders: Map<string, Reminder> = new Map();
let reminderIdCounter = 0;

const generateReminderId = (): string => {
  reminderIdCounter++;
  return `reminder_${Date.now()}_${reminderIdCounter}`;
};

const notifyUser = async (sessionId: string, message: string): Promise<void> => {
  console.log(`[Reminder] Session ${sessionId}: ${message}`);
};

const reminderSkill: SkillModule = {
  name: 'reminder',
  version: '1.0.0',

  tools: {
    set_reminder: {
      name: 'set_reminder',
      description: 'Set a reminder that will notify you at the specified time',
      category: 'productivity',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'The reminder message'
          },
          time: {
            type: 'string',
            description: 'When to remind: ISO date string (e.g., "2024-12-25T10:00:00") or relative time in minutes (e.g., "30")'
          }
        },
        required: ['message', 'time']
      },
      handler: async (params, context) => {
        const { message, time } = params as { message: string; time: string };

        let reminderTime: Date;
        
        if (/^\d+$/.test(time)) {
          const minutes = parseInt(time, 10);
          reminderTime = new Date(Date.now() + minutes * 60 * 1000);
        } else {
          reminderTime = new Date(time);
        }

        if (isNaN(reminderTime.getTime())) {
          return {
            success: false,
            error: 'Invalid date format. Use ISO date string or minutes from now.'
          };
        }

        const delay = reminderTime.getTime() - Date.now();
        if (delay < 0) {
          return {
            success: false,
            error: 'Reminder time is in the past'
          };
        }

        const reminderId = generateReminderId();
        
        const timer = setTimeout(async () => {
          await notifyUser(context.sessionId, `⏰ Reminder: ${message}`);
          reminders.delete(reminderId);
        }, delay);
        timer.unref(); // Don't block process exit

        const reminder: Reminder = {
          id: reminderId,
          message,
          time: reminderTime,
          sessionId: context.sessionId,
          timer
        };

        reminders.set(reminderId, reminder);

        return {
          success: true,
          output: `Reminder set for ${reminderTime.toLocaleString()}\nMessage: ${message}\nID: ${reminderId}`,
          metadata: {
            reminderId,
            time: reminderTime.toISOString()
          }
        };
      }
    },

    list_reminders: {
      name: 'list_reminders',
      description: 'List all active reminders',
      category: 'productivity',
      parameters: {
        type: 'object',
        properties: {}
      },
      handler: async () => {
        if (reminders.size === 0) {
          return {
            success: true,
            output: 'No active reminders'
          };
        }

        const reminderList = Array.from(reminders.values())
          .sort((a, b) => a.time.getTime() - b.time.getTime())
          .map((r, i) => {
            const timeStr = r.time.toLocaleString();
            const remaining = Math.max(0, Math.floor((r.time.getTime() - Date.now()) / 60000));
            return `${i + 1}. [${r.id}] ${r.message}\n   Time: ${timeStr} (in ${remaining} min)`;
          })
          .join('\n\n');

        return {
          success: true,
          output: `Active Reminders (${reminders.size}):\n\n${reminderList}`
        };
      }
    },

    cancel_reminder: {
      name: 'cancel_reminder',
      description: 'Cancel an active reminder',
      category: 'productivity',
      parameters: {
        type: 'object',
        properties: {
          reminder_id: {
            type: 'string',
            description: 'The ID of the reminder to cancel'
          }
        },
        required: ['reminder_id']
      },
      handler: async (params) => {
        const { reminder_id } = params as { reminder_id: string };

        const reminder = reminders.get(reminder_id);
        if (!reminder) {
          return {
            success: false,
            error: `Reminder not found: ${reminder_id}`
          };
        }

        if (reminder.timer) {
          clearTimeout(reminder.timer);
        }
        reminders.delete(reminder_id);

        return {
          success: true,
          output: `Reminder cancelled: ${reminder.message}`
        };
      }
    }
  },

  triggers: [
    {
      type: 'keyword',
      keywords: ['remind', '提醒', '闹钟', 'alarm', 'schedule']
    }
  ]
};

export default reminderSkill;
