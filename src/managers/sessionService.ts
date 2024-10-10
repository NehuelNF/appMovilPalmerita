import { Injectable } from "@angular/core";

@Injectable({
    providedIn: 'root'
})
export class sessionService {
  private credentials: { username: string, password: string, email: string }[] = [
    {
        username: "user",
        password: "pass",
        email: "test@email.com"
    },
  ];
  private currentUser: { username: string, password: string, email: string } | null = null;
  private isUserActive: boolean = false;

  public login(username: string, password: string): boolean {
    // Buscar usuario por nombre de usuario y contraseña
    const user = this.credentials.find(u => u.username === username && u.password === password);
    if (user) {
      this.currentUser = user;
      this.isUserActive = true;
      return true;
    }
    return false;
  }

  public register(username: string, password: string, email: string): boolean {
    // Verificar si el nombre de usuario ya está en uso
    if (this.credentials.some(u => u.username === username)) {
      return false;
    }

    // Agregar nuevo usuario
    this.credentials.push({ username, password, email });
    return true;
  }

  public getUser(): { email: string, username: string } | null {
    if (!this.currentUser) {
      return null;
    }
    return {
      email: this.currentUser.email,
      username: this.currentUser.username
    };
  }

  public isUserLoggedIn(): boolean {
    return this.isUserActive;
  }

}