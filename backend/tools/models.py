from django.db import models


class ExchangeRate(models.Model):
    """Rates are only ever stored from a real source (API response or admin entry with a named source)."""

    base = models.CharField(max_length=3, default="USD")
    quote = models.CharField(max_length=3)
    rate = models.DecimalField(max_digits=20, decimal_places=8)
    source = models.CharField(max_length=255)
    fetched_at = models.DateTimeField()

    class Meta:
        unique_together = ("base", "quote")
        ordering = ["quote"]

    def __str__(self):
        return f"1 {self.base} = {self.rate} {self.quote}"
