!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"

# Receives variables from the command line
# ${VERSION} - Version to generate (x.y.z)
# ${PLATFORM} - Platform to generate (win32 or win64)
# ${DEST_FOLDER} - Destination folder for the installer files

# Some definitions
!define SOURCE_FILES          "..\..\apps\betaflight-blackbox-explorer\${PLATFORM}\*"
!define APP_NAME              "Betaflight Blackbox Explorer"
!define COMPANY_NAME          "Betaflight Team"
!define GROUP_NAME            "Betaflight"
!define FOLDER_NAME           "Betaflight-Blackbox-Explorer"
!define FILE_NAME_INSTALLER   "betaflight-blackbox-explorer-installer_${VERSION}_${PLATFORM}.exe"
!define FILE_NAME_UNINSTALLER "uninstall-betaflight-blackbox-explorer.exe"
!define FILE_NAME_EXECUTABLE  "betaflight-blackbox-explorer.exe"
!define LICENSE               "..\..\LICENSE"
!define MUI_ICON              ".\bf_installer_icon.ico"
!define MUI_UNICON            ".\bf_uninstaller_icon.ico"

Name "${APP_NAME}"
BrandingText "${COMPANY_NAME}"

# set the icon

# define the resulting installer's name:
OutFile "..\..\${DEST_FOLDER}\${FILE_NAME_INSTALLER}"

# set the default installation directory
!if ${PLATFORM} == 'win64'
    InstallDir "$PROGRAMFILES64\${GROUP_NAME}\${FOLDER_NAME}\" 
!else
    InstallDir "$PROGRAMFILES\${GROUP_NAME}\${FOLDER_NAME}\"
!endif

# app dialogs
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE ${LICENSE}
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

!define MUI_FINISHPAGE_RUN "$INSTDIR\${FILE_NAME_EXECUTABLE}"

!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_LANGUAGE "English"

# default install dir, readed from registry from latest installation
InstallDirRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "InstallLocation"

# default section start
Section

    # remove the older version
    ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
            "InstallLocation"
 
    ${If} $R0 != ""
        # delete the installed files of the older version
        RMDir /r $R0
    ${EndIf}

    # define the path to which the installer should install
    SetOutPath $INSTDIR

    # specify the files to go in the output path
    File /r ${SOURCE_FILES}

    # create the uninstaller
    WriteUninstaller "$INSTDIR\${FILE_NAME_UNINSTALLER}"

    # create shortcuts in the start menu and on the desktop
    CreateDirectory "$SMPROGRAMS\${GROUP_NAME}\${FOLDER_NAME}"    
    CreateShortCut "$SMPROGRAMS\${GROUP_NAME}\${FOLDER_NAME}\${APP_NAME}.lnk" "$INSTDIR\${FILE_NAME_EXECUTABLE}"
    CreateShortCut "$SMPROGRAMS\${GROUP_NAME}\${FOLDER_NAME}\Uninstall ${APP_NAME}.lnk" "$INSTDIR\${FILE_NAME_UNINSTALLER}"
    CreateShortCut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${FILE_NAME_EXECUTABLE}"
    
    # include in add/remove programs
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
                "Publisher" "${COMPANY_NAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
                "DisplayName" "${APP_NAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
                "DisplayIcon" "$\"$INSTDIR\${FILE_NAME_EXECUTABLE}$\""
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
                "UninstallString" "$\"$INSTDIR\${FILE_NAME_UNINSTALLER}$\""
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
                "InstallLocation" "$INSTDIR"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
                "DisplayVersion" "${VERSION}"

    # estimate the size
    ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
    IntFmt $0 "0x%08X" $0
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
                "EstimatedSize" "$0"


SectionEnd

# create a section to define what the uninstaller does
Section "Uninstall"

    # delete the installed files
    RMDir /r $INSTDIR

    # delete the shortcuts
    Delete "$SMPROGRAMS\${GROUP_NAME}\${FOLDER_NAME}\${APP_NAME}.lnk"
    Delete "$SMPROGRAMS\${GROUP_NAME}\${FOLDER_NAME}\Uninstall ${APP_NAME}.lnk"
    RMDir "$SMPROGRAMS\${GROUP_NAME}\${FOLDER_NAME}"
    RMDir "$SMPROGRAMS\${GROUP_NAME}"
    Delete "$DESKTOP\${APP_NAME}.lnk"
    
    # remove from add/remove programs
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}"

SectionEnd