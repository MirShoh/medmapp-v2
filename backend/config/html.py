"""HTML sanitising for staff-authored rich text before it is sent to the public site."""
import nh3

ALLOWED_TAGS = {
    "p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "h2", "h3", "h4", "blockquote",
    "a", "img", "table", "thead", "tbody", "tr", "th", "td", "hr", "span", "div", "figure", "figcaption",
}
ALLOWED_ATTRS = {"a": {"href", "title", "target"}, "img": {"src", "alt", "title", "width", "height"}, "*": {"class"}}


def clean_html(value):
    if not value or not isinstance(value, str):
        return value
    if "<" not in value:
        return value  # plain text: rendered as text by the frontend
    return nh3.clean(value, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS, url_schemes={"http", "https", "mailto", "tel"},
                     link_rel="noopener noreferrer")


class SanitizeHTMLMixin:
    """Serializer mixin: list fields in `html_fields` to sanitise them on output."""

    html_fields = ()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        for f in self.html_fields:
            if f in data:
                data[f] = clean_html(data[f])
        return data
