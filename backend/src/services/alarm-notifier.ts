import { logger } from "../utils/logger.js";

export type AlarmNotificationPayload = {
  alarmEventId: string;
  organisationId: string;
  siteId: string;
  severity: string;
  title: string;
  message: string;
};

export interface AlarmEmailNotifier {
  sendAlarmEmail(payload: AlarmNotificationPayload): Promise<void>;
}

export interface AlarmWebhookNotifier {
  sendAlarmWebhook(payload: AlarmNotificationPayload): Promise<void>;
}

export class StubAlarmEmailNotifier implements AlarmEmailNotifier {
  async sendAlarmEmail(payload: AlarmNotificationPayload): Promise<void> {
    logger.info("Alarm email stub (not sent).", {
      channel: "email",
      alarmEventId: payload.alarmEventId,
      severity: payload.severity,
      title: payload.title
    });
  }
}

export class StubAlarmWebhookNotifier implements AlarmWebhookNotifier {
  async sendAlarmWebhook(payload: AlarmNotificationPayload): Promise<void> {
    logger.info("Alarm webhook stub (not sent).", {
      channel: "webhook",
      alarmEventId: payload.alarmEventId,
      severity: payload.severity,
      title: payload.title
    });
  }
}

const defaultEmailNotifier = new StubAlarmEmailNotifier();
const defaultWebhookNotifier = new StubAlarmWebhookNotifier();

export const notifyAlarmRaised = async (payload: AlarmNotificationPayload): Promise<void> => {
  await Promise.all([
    defaultEmailNotifier.sendAlarmEmail(payload),
    defaultWebhookNotifier.sendAlarmWebhook(payload)
  ]);
};
