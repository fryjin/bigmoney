<script setup lang="ts">
import {
  formatInternalMoney,
  type ForcedPayment,
  type LiquidationQuote
} from '@bigmoney/game-core';

interface LiquidationPropertyOption {
  propertyId: string;
  name: string;
  level: number;
  liquidationValue: number;
}

const props = defineProps<{
  payment: ForcedPayment;
  payerName: string;
  receiverName: string | null;
  sourceText: string;
  candidates: LiquidationPropertyOption[];
  selectedPropertyIds: string[];
  quote: LiquidationQuote;
  submitting: boolean;
}>();

const emit = defineEmits<{
  toggleProperty: [propertyId: string];
  confirm: [];
}>();

function isSelected(propertyId: string): boolean {
  return props.selectedPropertyIds.includes(propertyId);
}

</script>

<template>
  <article class="decision-modal liquidation-modal" aria-labelledby="liquidation-title">
    <span class="eyebrow">资金不足 · Liquidation</span>
    <h2 id="liquidation-title">需要支付</h2>
    <p class="modal-lead">
      {{ payerName }} 需要处理{{ sourceText }}。
      <template v-if="receiverName">收款方：{{ receiverName }}。</template>
    </p>

    <dl class="liquidation-summary">
      <div>
        <dt>应付金额</dt>
        <dd>{{ formatInternalMoney(payment.amount) }}</dd>
      </div>
      <div>
        <dt>当前现金</dt>
        <dd>{{ formatInternalMoney(quote.availableCash) }}</dd>
      </div>
      <div class="liquidation-shortfall">
        <dt>当前资金缺口</dt>
        <dd>{{ formatInternalMoney(quote.remainingAmount) }}</dd>
      </div>
    </dl>

    <div class="option-label">可清算地产</div>
    <div class="liquidation-candidates" aria-label="可清算地产">
      <button
        v-for="candidate in candidates"
        :key="candidate.propertyId"
        class="liquidation-property"
        :class="{ selected: isSelected(candidate.propertyId) }"
        type="button"
        :aria-pressed="isSelected(candidate.propertyId)"
        :disabled="submitting"
        @click="emit('toggleProperty', candidate.propertyId)"
      >
        <span class="liquidation-property-check" aria-hidden="true">
          {{ isSelected(candidate.propertyId) ? '✓' : '' }}
        </span>
        <span class="liquidation-property-copy">
          <strong>{{ candidate.name }}</strong>
          <small>当前等级 L{{ candidate.level }}</small>
        </span>
        <span class="liquidation-property-value">
          <small>可回收</small>
          <strong>{{ formatInternalMoney(candidate.liquidationValue) }}</strong>
        </span>
      </button>
    </div>

    <dl class="liquidation-summary liquidation-quote">
      <div>
        <dt>已选回收</dt>
        <dd>{{ formatInternalMoney(quote.liquidationValue) }}</dd>
      </div>
      <div>
        <dt>清算后预计现金</dt>
        <dd>{{ formatInternalMoney(quote.cashAfterLiquidation) }}</dd>
      </div>
      <div :class="{ 'liquidation-shortfall': quote.remainingAmount > 0 }">
        <dt>{{ quote.remainingAmount > 0 ? '仍差' : '资金缺口' }}</dt>
        <dd>{{ formatInternalMoney(quote.remainingAmount) }}</dd>
      </div>
    </dl>

    <p v-if="quote.remainingAmount > 0" class="liquidation-note">
      本次可以部分清算；若仍不足，将继续显示剩余可清算地产。
    </p>

    <div class="modal-actions">
      <button
        class="primary-action liquidation-submit"
        type="button"
        :disabled="
          submitting ||
          selectedPropertyIds.length === 0
        "
        @click="emit('confirm')"
      >
        {{ submitting ? '正在清算…' : '清算所选资产' }}
      </button>
    </div>
  </article>
</template>
