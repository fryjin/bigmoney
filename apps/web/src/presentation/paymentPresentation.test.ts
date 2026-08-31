import { describe, expect, it } from 'vitest';
import { fullMap36Content } from '@bigmoney/game-content';
import {
  getCompletedPublicFeePresentation,
  getPaymentPresentation
} from './paymentPresentation';

describe('payment presentation', () => {
  it.each([
    [
      'RESERVED_FACILITY_01',
      30,
      '公共设施费用 · 城市服务中心',
      '城市服务中心 已支付300万元公共设施费用'
    ],
    [
      'RESERVED_FACILITY_02',
      50,
      '公共设施费用 · 中央枢纽',
      '中央枢纽 已支付500万元公共设施费用'
    ]
  ] as const)(
    'uses the canonical facility tile %s for PUBLIC_FEE source and completion copy',
    (tileId, amount, sourceText, completionText) => {
      expect(
        getPaymentPresentation(fullMap36Content, {
          id: 'PAYMENT-0001',
          payerId: 'P1',
          receiverId: null,
          amount,
          reason: 'PUBLIC_FEE',
          tileId
        })
      ).toEqual({ sourceText, completionText });
    }
  );

  it('keeps RENT and EVENT_EXPENSE presentation sources unchanged', () => {
    expect(
      getPaymentPresentation(fullMap36Content, {
        id: 'PAYMENT-0002',
        payerId: 'P1',
        receiverId: 'P2',
        amount: 15,
        reason: 'RENT',
        propertyId: 'HARBOR_01'
      })
    ).toEqual({ sourceText: '地产租金', completionText: null });
    expect(
      getPaymentPresentation(fullMap36Content, {
        id: 'PAYMENT-0003',
        payerId: 'P1',
        receiverId: null,
        amount: 30,
        reason: 'EVENT_EXPENSE',
        eventId: 'EVENT_REPAIR_FEE',
        title: '临时维修费',
        description: '支付300万元公共维修费。'
      })
    ).toEqual({ sourceText: '城市费用', completionText: null });
  });

  it('does not guess a facility source for an invalid PUBLIC_FEE tileId', () => {
    expect(
      getPaymentPresentation(fullMap36Content, {
        id: 'PAYMENT-0004',
        payerId: 'P1',
        receiverId: null,
        amount: 30,
        reason: 'PUBLIC_FEE',
        tileId: 'PROPERTY_HARBOR_01'
      })
    ).toEqual({ sourceText: '公共费用（来源无效）', completionText: null });
  });

  it('finds PUBLIC_FEE completion before the destination batch turn-ready event', () => {
    const payment = {
      id: 'PAYMENT-0005',
      payerId: 'P1',
      receiverId: null,
      amount: 30,
      reason: 'PUBLIC_FEE' as const,
      tileId: 'RESERVED_FACILITY_01'
    };

    expect(
      getCompletedPublicFeePresentation(fullMap36Content, [
        { type: 'PAYMENT_REQUESTED', payment },
        { type: 'PAYMENT_COMPLETED', payment },
        { type: 'TURN_READY_TO_END', playerId: 'P1' }
      ])
    ).toEqual({
      sourceText: '公共设施费用 · 城市服务中心',
      completionText: '城市服务中心 已支付300万元公共设施费用'
    });
  });
});
