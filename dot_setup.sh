#!/bin/env bash
# the file is maintained in 'dotfiles' repo.

# generating locale
if  grep -q '#en_US.UTF-8 UTF-8' '/etc/locale.gen'
then
  sudo sed -i 's/#en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/g' /etc/locale.gen
  echo "locale value activated in /etc/locale.gen" 
  sudo locale-gen
  echo "reboot...." 
  exit
elif grep -q '^en_US.UTF-8 UTF-8' '/etc/locale.gen'
then
  echo "locale value already active in /etc/locale.gen" 
else
  sudo echo 'en_US.UTF-8 UTF-8' >> /etc/locale.gen
  echo "locale value added in /etc/locale.gen" 
  sudo locale-gen
  echo "reboot...." 
  exit
fi


if [ -x "$(command -v pacman)" ]; then
  sudo -i pacman -Syu
  sudo -i pacman --needed --noconfirm -Sy openssh git
fi

# crontab entries
# * * * * * 'sudo -i arpon -d -i wlp3s0 -D'

# fstab entry for windows mount
# UUID=CC8AA6D38AA6B97A /mnt/windows/  ntfs    defaults,noatime 0 2

# mount shared host dir from windows host to linux guest vbox
# sudo mount -t vboxsf shared_host_dir_name /path/to/guest/dir

if [[ -e $HOME/.ssh ]]; then
  rm -rf $HOME/.ssh
fi

cat /dev/zero | ssh-keygen -b 2048 -t rsa -q -N "" -C $(whoami)@$(echo $(uname -nmo; grep -P ^NAME /etc/os-release | sed -E -e 's/NAME="(.*)"/\1/g' | tr ' ' '_' ; date +%F) | tr ' ' '::')

printf '\nenter github username: ' 
read user
read -sp "enter github pass: " pass

curl -u "${user}:${pass}" --data "{ \"key\": \"$(cat ~/.ssh/id_rsa.pub)\"}" https://api.github.com/user/keys

ssh-keyscan github.com >> ~/.ssh/known_hosts
git clone git@github.com:glados-418/dotfiles.git temp_dotfiles

source temp_dotfiles/.bashrc

cd $HOME
rm -rf temp_dotfiles

git clone git@github.com:glados-418/dotfiles.git
git clone git@github.com:glados-418/vim.git

cd dotfiles

if [[ -e $HOME/.bashrc ]]; then
  rm $HOME/.bashrc
fi

if [[ -e $HOME/.inputrc ]]; then
  rm $HOME/.inputrc
fi

#installed packaged
if [ -x "$(command -v pacman)" ]; then
  cat paclist | tr '\n' ' ' | xargs sudo -i pacman --needed --noconfirm -Sy
  cat yaylist | tr '\n' ' ' | xargs yay --needed --noconfirm -Sy
else
  echo "pacman not installed..."
fi

if [[ ! -d $HOME/.local/share/fonts ]]; then
  mkdir -p $HOME/.local/share/fonts
fi

cp -r $HOME/vim/fonts/* $HOME/.local/share/fonts/

if [[ -e $HOME/.vimrc ]]; then
  rm $HOME/.vimrc
fi

if [[ -e $HOME/.vim ]]; then
  rm -rf $HOME/.vim
fi

#do this after package install to avoid ycm build errors
vim +PlugInstall +qall

ln -s $PWD/.bashrc $HOME/.bashrc
ln -s $PWD/.bash_aliases $HOME/.bash_aliases
ln -s $PWD/.inputrc $HOME/.inputrc
ln -s $HOME/vim/vim/.vim $HOME/.vim
ln -s $HOME/vim/vim/.vimrc $HOME/.vimrc
