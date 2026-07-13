# Publier RJH Live Match sur GitHub

Ce guide permet d'obtenir un lien web pour l'app, sans garder le Mac allume.

## 1. Creer le depot GitHub

1. Va sur https://github.com
2. Clique sur `+` puis `New repository`
3. Nom conseille : `rjh-live-match`
4. Choisis `Public`
5. Clique sur `Create repository`

## 2. Envoyer le projet

Depuis le dossier du projet sur le Mac :

```bash
cd /Users/anicetvercaigne/Documents/27
git init
git add .
git commit -m "Premiere version RJH Live Match"
git branch -M main
git remote add origin https://github.com/TON-NOM-GITHUB/rjh-live-match.git
git push -u origin main
```

Remplace `TON-NOM-GITHUB` par ton identifiant GitHub.

## 3. Activer GitHub Pages

1. Sur GitHub, ouvre le depot `rjh-live-match`
2. Va dans `Settings`
3. Clique sur `Pages`
4. Dans `Build and deployment`, choisis `GitHub Actions`
5. Attends une ou deux minutes
6. Va dans l'onglet `Actions` pour voir si la publication est terminee

## 4. Ouvrir l'app

Le lien aura cette forme :

```text
https://TON-NOM-GITHUB.github.io/rjh-live-match/
```

## Important

Les matchs sont sauvegardes dans le navigateur de l'appareil utilise.

Donc :

- un match encode sur iPhone reste sur l'iPhone ;
- un match encode sur Mac reste sur le Mac ;
- il n'y a pas de synchronisation automatique entre les appareils.
