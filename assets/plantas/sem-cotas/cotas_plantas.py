"""Cotas nas plantas humanizadas do Reserva dos Ipês (executivos ARQ TP 1..6 R01).
Render = planta executiva girada 90° anti-horário: fundo do lote à esquerda, rua à direita.
  d = profundidade a partir da divisa de FUNDO  -> eixo X
  w = largura a partir da divisa ESQUERDA da planta executiva -> eixo Y (w = 0 embaixo)
Internas: medidas internas de cada ambiente (comprimento junto à parede de baixo, à esquerda;
largura em pé junto à parede da direita, no alto). Externas: só divisas e totais."""
import sys
from PIL import Image, ImageDraw, ImageFont

FONTE = '/usr/share/fonts/opentype/inter/Inter-SemiBold.otf'   # Inter SemiBold (trocar o caminho no Windows)
F, FI = ImageFont.truetype(FONTE, 30), ImageFont.truetype(FONTE, 25)
COR, BR, SB = (90, 58, 11), (255, 255, 255), (40, 32, 20)
TXT, HALO = (55, 45, 35), (255, 255, 255)
PROF, LARG = 10.30, 7.18          # casa: profundidade e largura (cadeias do executivo)

# lote (x0, x1, y0, y1) e casa (x0, x1, y0, y1) medidos no render 2400x1350
TIPOS = {
 'tipo-1':   dict(lado='A', R=1.88, B=4.70, lote=(35, 2026, 238, 1135),  casa=(498, 1500, 243, 935),  tot=('20,00', '9,00'),  vert='esq'),
 'decorado': dict(lado='A', R=1.88, B=4.70, lote=(50, 2062, 244, 1136),  casa=(521, 1541, 247, 949),  tot=('20,00', '9,00'),  vert='dir'),
 'tipo-2':   dict(lado='B', R=3.23, B=2.10, lote=(42, 2045, 92, 1252),   casa=(276, 1446, 437, 1250), tot=('17,40', '10,35'), vert='dir'),
 'tipo-3':   dict(lado='A', R=3.23, B=2.10, lote=(46, 2072, 82, 1260),   casa=(297, 1468, 82, 905),   tot=('17,40', '10,35'), vert='dir'),
 'tipo-4':   dict(lado='B', R=1.88, B=4.70, lote=(26, 2142, 198, 1146),  casa=(520, 1596, 397, 1139), tot=('20,00', '9,00'),  vert='esq'),
 'tipo-5':   dict(lado='A', R=3.41, B=1.80, lote=(34, 1916, 94, 1226),   casa=(232, 1342, 94, 863),   tot=('17,10', '10,53'), vert='esq'),
}
# ambientes: (w0, w1) na largura da CASA (0 = parede externa do lado da suíte em 'A' / da área de serviço em 'B'),
#            (d0, d1) na profundidade da CASA (0 = parede de fundo), comprimento, largura
AMB_A = [((0.12, 3.64), (0.12, 3.32), '3,20', '3,52', False),   # suíte
         ((3.76, 4.96), (0.12, 2.62), '2,50', '1,20', True),    # banho 02 (nome do ambiente na base)
         ((5.08, 7.00), (0.00, 2.62), '2,62', '1,92', False),   # área de serviço
         ((3.76, 7.00), (2.74, 6.24), '3,50', '3,24', False),   # cozinha
         ((3.76, 7.00), (6.24, 9.27), '3,03', '3,24', False),   # sala
         ((0.12, 2.62), (3.44, 5.94), '2,50', '2,50', False),   # quarto 02
         ((0.12, 2.62), (6.06, 7.31), '1,25', '2,50', False),   # banho 01
         ((0.12, 3.64), (7.43, 10.18), '2,75', '3,52', False)]  # quarto 01
AMB_B = [((0.18, 2.10), (0.00, 2.62), '2,62', '1,92', False),   # área de serviço
         ((2.22, 3.42), (0.12, 2.62), '2,50', '1,20', False),   # banho 02
         ((3.54, 7.06), (0.12, 3.32), '3,20', '3,52', False),   # suíte
         ((0.18, 3.42), (2.74, 6.24), '3,50', '3,24', False),   # cozinha
         ((0.18, 3.42), (6.24, 9.27), '3,03', '3,24', False),   # sala
         ((4.56, 7.06), (3.44, 5.94), '2,50', '2,50', False),   # quarto 02
         ((4.56, 7.06), (6.06, 7.31), '1,25', '2,50', False),   # banho 01
         ((3.54, 7.06), (7.43, 10.18), '2,75', '3,52', False)]  # quarto 01

def br(v): return ('%.2f' % v).replace('.', ',')

def gerar(nome, cfg, src, dst):
    im = Image.open(src).convert('RGB'); dr = ImageDraw.Draw(im)
    lx0, lx1, ly0, ly1 = cfg['lote']; hx0, hx1, hy0, hy1 = cfg['casa']
    Sx, Sy = (hx1 - hx0) / PROF, (hy1 - hy0) / LARG
    X = lambda d: hx0 + d * Sx                     # d na casa
    Y = lambda w: hy1 - w * Sy                     # w na casa (0 embaixo)

    def tick(x, y, c, lw=3, t=11): dr.line([(x - t, y + t), (x + t, y - t)], fill=c, width=lw)
    def cota_h(y, xs, rot):
        dr.line([(xs[0] - 14, y), (xs[-1] + 14, y)], fill=COR, width=2)
        for x in xs: dr.line([(x, y - 14), (x, y + 14)], fill=COR, width=2); tick(x, y, COR)
        for (i, j), t in rot.items():
            tw = dr.textlength(t, font=F); dr.text(((xs[i] + xs[j]) / 2 - tw / 2, y - 40), t, font=F, fill=COR)
    def cota_v(x, ys, rot, cor, sombra):
        for c, lw in [(sombra, 5), (cor, 2)]:
            dr.line([(x, min(ys) - 14), (x, max(ys) + 14)], fill=c, width=lw)
            for y in ys: dr.line([(x - 14, y), (x + 14, y)], fill=c, width=lw); dr.line([(x - 11, y + 11), (x + 11, y - 11)], fill=c, width=lw + 1)
        for (i, j), t in rot.items():
            tw = dr.textlength(t, font=F); img = Image.new('RGBA', (int(tw) + 16, 44), (0, 0, 0, 0))
            ImageDraw.Draw(img).text((8, 4), t, font=F, fill=cor, stroke_width=3, stroke_fill=sombra)
            img = img.rotate(90, expand=True); cy = (ys[i] + ys[j]) / 2
            im.paste(img, (int(x - 46), int(cy - img.size[1] / 2)), img)

    # ---- externas: só divisas e totais ----
    mt, mb = ly0, im.size[1] - ly1                  # margens brancas acima e abaixo do lote
    yt = max(48, ly0 - min(60, mt // 2 + 6)); yb = ly1 + min(75, mb // 2 + 6)
    cota_h(yt, [lx0, lx1], {(0, 1): cfg['tot'][0]})
    cota_h(yb, [lx0, hx0, hx1, lx1], {(0, 1): br(cfg['B']), (1, 2): '10,30', (2, 3): '5,00'})
    rec = [ly1, hy1] if cfg['lado'] == 'A' else [hy0, ly0]          # afastamento lateral
    if cfg['vert'] == 'esq': xa, xb = lx0 + 45, lx0 + 105
    else:                    xa, xb = im.size[0] - 150, im.size[0] - 90
    cota_v(xa, [ly0, ly1], {(0, 1): cfg['tot'][1]}, BR, SB)
    cota_v(xb, rec, {(0, 1): br(cfg['R'])}, BR, SB)

    # ---- internas ----
    def rot_txt(t, x, y, ang):
        tw = int(dr.textlength(t, font=FI)) + 12; img = Image.new('RGBA', (tw, 38), (0, 0, 0, 0))
        ImageDraw.Draw(img).text((6, 3), t, font=FI, fill=TXT, stroke_width=3, stroke_fill=HALO)
        if ang: img = img.rotate(ang, expand=True)
        im.paste(img, (int(x), int(y)), img)
    pad = 10
    for (w0, w1), (d0, d1), comp, larg, topo in (AMB_A if cfg['lado'] == 'A' else AMB_B):
        xa_, xb_, ya_, yb_ = X(d0), X(d1), Y(w1), Y(w0)
        rot_txt(comp, xa_ + pad, (ya_ + pad) if topo else (yb_ - pad - 36), 0)
        rot_txt(larg, xb_ - pad - 38, ya_ + pad, 90)

    im.save(dst, quality=90)
    for lado in (1400, 480):
        im.resize((lado, round(lado * im.size[1] / im.size[0])), Image.LANCZOS).save(dst.replace('.jpg', f'-{lado}.jpg'), quality=86)

if __name__ == '__main__':
    # rodar dentro de assets/plantas/sem-cotas:  python cotas_plantas.py  (grava em assets/plantas)
    import os
    aqui = os.path.dirname(os.path.abspath(__file__)); saida = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(aqui)
    for nome, cfg in TIPOS.items():
        gerar(nome, cfg, os.path.join(aqui, f'{nome}.jpg'), os.path.join(saida, f'{nome}.jpg')); print('ok', nome)
