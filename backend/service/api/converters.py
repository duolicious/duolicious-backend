from werkzeug.routing import PathConverter


class LeadingSlashPathConverter(PathConverter):
    """
    Like the built-in ``path`` converter but also accepts a leading slash.

    Club names may legitimately begin with a slash (e.g. "/a/",
    "/storytime/"), and such names reach us percent-encoded as "%2Fa%2F". The
    WSGI layer decodes "%2F" to "/" before routing, so the name arrives with a
    leading slash; the stock ``path`` converter's regex ("[^/].*?") rejects
    that. Register this under a name (e.g. "clubname") and use it together with
    ``merge_slashes=False`` on the route so the resulting "//" isn't collapsed
    into a 308 redirect.

    ``part_isolating = False`` must be set explicitly: Werkzeug's state-machine
    matcher only lets a converter span multiple "/"-separated segments when
    this is False, and it is otherwise re-derived per subclass from whether the
    regex contains a literal "/" (our ".+?" has none, so it would default to
    True and match only a single segment).
    """
    part_isolating = False
    regex = ".+?"
