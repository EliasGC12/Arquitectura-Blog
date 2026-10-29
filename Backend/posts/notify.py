from .models import Notification


def push_notification(*, recipient, sender, notification_type, message, related_post=None):
    if recipient is None:
        return None
    if sender is not None and recipient.pk == sender.pk:
        return None
    text = (message or "").strip()
    if not text:
        return None
    return Notification.objects.create(
        recipient=recipient,
        sender=sender,
        notification_type=notification_type,
        message=text,
        related_post=related_post,
    )
