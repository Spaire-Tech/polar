from ..base.properties import BenefitGrantProperties, BenefitProperties


class BenefitNewsletterAccessProperties(BenefitProperties):
    newsletter_id: str


class BenefitGrantNewsletterAccessProperties(BenefitGrantProperties):
    subscription_id: str | None
