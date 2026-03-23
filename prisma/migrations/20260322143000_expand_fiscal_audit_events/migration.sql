-- Expand fiscal audit event check constraint for counterparty resolution flows
ALTER TABLE "fiscal_audit_logs"
    DROP CONSTRAINT IF EXISTS "fiscal_audit_logs_event_check";

ALTER TABLE "fiscal_audit_logs"
    ADD CONSTRAINT "fiscal_audit_logs_event_check" CHECK (
        "event" IN (
            'fiscal_document_edited',
            'fiscal_document_edit_blocked',
            'counterparty_auto_linked',
            'counterparty_confirmed',
            'counterparty_rejected',
            'counterparty_created_and_linked',
            'counterparty_kept_in_review',
            'period_closed',
            'period_reopened'
        )
    );
