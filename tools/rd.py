"""WGS84 (lat/lon) naar Rijksdriehoek (EPSG:28992), benaderingsformule (fout < 1 m).

Bron: F.H. Schreutelkamp & G.L. Strang van Hees, 'Benaderingsformules voor de
transformatie tussen RD- en WGS84-kaartcoördinaten'.
"""

_R = [(0, 1, 190094.945), (1, 1, -11832.228), (2, 1, -114.221), (0, 3, -32.391),
      (1, 0, -0.705), (3, 1, -2.340), (1, 3, -0.608), (0, 2, -0.008), (2, 3, 0.148)]
_S = [(1, 0, 309056.544), (0, 2, 3638.893), (2, 0, 73.077), (1, 2, -157.984),
      (3, 0, 59.788), (0, 1, 0.433), (2, 2, -6.439), (1, 1, -0.032), (0, 4, 0.092),
      (1, 4, -0.054)]


def naar_rd(lat, lon):
    dphi = 0.36 * (lat - 52.15517440)
    dlam = 0.36 * (lon - 5.38720621)
    x = 155000.0
    y = 463000.0
    for p, q, r in _R:
        x += r * dphi ** p * dlam ** q
    for p, q, s in _S:
        y += s * dphi ** p * dlam ** q
    return x, y


if __name__ == "__main__":
    # Onze Lieve Vrouwetoren Amersfoort ligt per definitie op (155000, 463000)
    print(naar_rd(52.15517440, 5.38720621))
    # Utrecht Centraal, ongeveer (136000, 456000)
    print(naar_rd(52.0894, 5.1101))
