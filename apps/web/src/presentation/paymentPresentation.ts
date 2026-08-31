import {
  formatInternalMoney,
  type DomainEvent,
  type ForcedPayment
} from '@bigmoney/game-core';
import type {
  GameContent,
  TechnicalSliceContent
} from '@bigmoney/game-content';

type BoardContent = GameContent | TechnicalSliceContent;

export interface PaymentPresentation {
  sourceText: string;
  completionText: string | null;
}

export function getPaymentPresentation(
  content: BoardContent,
  payment: ForcedPayment
): PaymentPresentation {
  if (payment.reason === 'RENT') {
    return { sourceText: '地产租金', completionText: null };
  }
  if (payment.reason === 'EVENT_EXPENSE') {
    return { sourceText: '城市费用', completionText: null };
  }

  const tile = content.tiles.find((candidate) => candidate.id === payment.tileId);
  if (tile?.type !== 'FACILITY') {
    return { sourceText: '公共费用（来源无效）', completionText: null };
  }

  const amountText = formatInternalMoney(payment.amount);
  return {
    sourceText: `公共设施费用 · ${tile.name}`,
    completionText: `${tile.name} 已支付${amountText}公共设施费用`
  };
}

export function getCompletedPublicFeePresentation(
  content: BoardContent,
  events: DomainEvent[]
): PaymentPresentation | null {
  const completed = [...events]
    .reverse()
    .find(
      (event): event is Extract<DomainEvent, { type: 'PAYMENT_COMPLETED' }> =>
        event.type === 'PAYMENT_COMPLETED' && event.payment.reason === 'PUBLIC_FEE'
    );
  return completed ? getPaymentPresentation(content, completed.payment) : null;
}
